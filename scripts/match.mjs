/** @typedef {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatLogEntry_t} chatLogEntry_t */
import { translate } from 'npm:@vitalets/google-translate-api'
import { francAll } from 'npm:franc'
import * as OpenCC from 'npm:opencc-js'

import { charname } from '../charbase.mjs'

import { remove_kaomoji } from './dict.mjs'
import { normalizeFancyText } from './fancytext.mjs'
import { is_PureChinese } from './langdetect.mjs'
import { escapeRegExp } from './tools.mjs'

const chT2S = OpenCC.Converter({ from: 'twp', to: 'cn' })
/**
 * 将繁体中文内容转换为简体中文。
 * @param {string} content - 要转换的文本内容。
 * @returns {string} - 转换后的简体中文内容。
 */
export function SimplifyChinese(content) {
	return chT2S(content)
}
/**
 * A simpler version of SimplifiyContent that does not do any translation.
 * @param {string} content
 * @returns {[string, string, string]} The input, its simplified chinese version, and its normalized fancy text version
 */
function SimpleSimplify(content) {
	const base_content = SimplifyChinese(content)
	return [content, base_content, normalizeFancyText(base_content)]
}

/**
 * 简化给定的内容，以便在 prompt 中使用。
 * 如果内容不是纯中文，会先尝试将其翻译为中文。
 * @param {string} content - 要简化的内容。
 * @returns {Promise<[string, string, string]>} - 一个数组，包含原始输入、简体中文版本和标准化花式文本版本。
 */
export async function SimplifiyContent(content) {
	content = remove_kaomoji(content)
	if (!content.trim()) return [content]
	/** @type {string} */
	let simplified_langcheck_content = content.replace(/(:|@\w*|\/)\b\d+(?:\.\d+)?\b/g, '').replace(/@\w*/g, '').replace(/https?:\/\/[\w#%+.:=@\\~-]+/g, '')
	simplified_langcheck_content = simplified_langcheck_content.replace(/```+.*\n[^]*?```+/g, '')
	simplified_langcheck_content = simplified_langcheck_content.replace(/(命令|代码|错误|stdout|stderr)(:|：)\s*`[^\n]*?`/g, '')
	simplified_langcheck_content = simplified_langcheck_content.replace(/\b@[^\s!,.?。！，？]\b/, '')
	if (!is_PureChinese(simplified_langcheck_content)) {
		console.info('%ccontent "' + content + '" is not pure chinese, translating it for prompt building logic', 'color: red')
		console.log('franc result:', francAll(content, { minLength: 0 }))
		while (true)
			try {
				content = (await translate(content, { from: 'auto', to: 'zh-CN' })).text
				break
			}
			catch (e) {
				if (e.name == 'TooManyRequestsError') {
					console.info('Translate API rate limit exceeded, waiting 5 second before retrying')
					await new Promise(resolve => setTimeout(resolve, 5000))
				}
				else {
					console.error('Failed to translate content "' + content + '": ', e)
					break
				}
			}
	}
	return SimpleSimplify(content)
}

/**
 * 预处理内容（通常是聊天记录条目），并返回一个扩展了输入 extension 的字典。
 * 返回的字典包含 `SimplifiedContents` 属性，这是一个包含原始内容、简化内容和标准化简化内容的数组。
 * @template T
 * @param {string} content - 要预处理的内容。
 * @param {T} [extension={}] - 要扩展的输入 extension。
 * @returns {Promise<T & { SimplifiedContents: string[] }>} - 预处理后的内容。
 */
export async function PreprocessContent(content, extension = {}) {
	extension ||= {}
	extension.SimplifiedContents ??= await SimplifiyContent(content)

	return extension
}

/**
 * 预处理单个聊天记录条目，为其添加简化后的内容。
 * @param {chatLogEntry_t} entry - 要处理的聊天记录条目。
 * @returns {Promise<string[]>} - 一个数组，包含原始内容和简化后的内容。
 */
export async function PreprocessChatLogEntry(entry) {
	entry.extension = await PreprocessContent(entry.content, entry.extension)
	return [entry.content, ...entry.extension.SimplifiedContents]
}

/**
 * 匹配内容中的关键字。
 * @param {string} content - 要匹配的内容。
 * @param {(string|RegExp)[]} keys - 关键字数组。
 * @param {Function} [matcher] - 自定义匹配器函数。
 * @returns {number} - 匹配到的关键字数量。
 */
export function base_match_keys(content, keys,
	matcher = (content, reg_keys) => {
		const contents = SimpleSimplify(content)
		return Math.max(...contents.map(content => reg_keys.filter(key => content.match(key)).length))
	}
) {
	// convert all keys to regexp, if it's have chinese like character, no match hole word
	keys.forEach(key => {
		if (key instanceof RegExp) key.lastIndex = 0
	})
	keys = keys.map(key =>
		key instanceof RegExp ? key :
			new RegExp(/\p{Unified_Ideograph}/u.test(key) ? escapeRegExp(key) : `\\b${escapeRegExp(key)}\\b`, 'ugi'))

	return matcher(content, keys)
}

/**
 * 检查内容中是否包含所有指定的关键字。
 * @param {string} content - 要匹配的内容。
 * @param {(string|RegExp)[]} keys - 关键字数组。
 * @returns {boolean} - 如果所有关键字都匹配到，则返回 true，否则返回 false。
 */
export function base_match_keys_all(content, keys) {
	return base_match_keys(content, keys, (content, reg_keys) => {
		const contents = SimpleSimplify(content)
		return contents.some(content => reg_keys.every(key => content.match(key)))
	})
}

/**
 * 计算内容中关键字的出现次数。
 * @param {string} content - 要匹配的内容。
 * @param {(string|RegExp)[]} keys - 关键字数组。
 * @returns {number} - 关键字出现的总次数。
 */
export function base_match_keys_count(content, keys) {
	return base_match_keys(content, keys, (content, reg_keys) => {
		const contents = SimpleSimplify(content)
		return contents.filter(content => reg_keys.map(key => content.match(key)?.length || 0).reduce((a, b) => a + b)).length
	})
}

/**
 * 返回按深度和角色范围限定的聊天记录子集。
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {'user'|'char'|'both'|'other'|'any'} [from='any'] - 按角色筛选。
 * @param {number} [depth=4] - 要返回的条目数。
 * @returns {chatLogEntry_t[]} - 限定范围后的聊天记录。
 */
export function getScopedChatLog(args, from = 'any', depth = 4) {
	// pickup the last few entry of chat_log
	let chat_log = args.chat_log.slice(-depth)
	// filter roles
	switch (from) {
		case 'user':
			chat_log = chat_log.filter(x => x.name == args.UserCharname)
			break
		case 'notuser':
			chat_log = chat_log.filter(x => x.name != args.UserCharname)
			break
		case 'char':
			chat_log = chat_log.filter(x => x.name == args.Charname)
			break
		case 'notchar':
			chat_log = chat_log.filter(x => x.name != args.Charname)
			break
		case 'both':
			chat_log = chat_log.filter(x => x.name == args.UserCharname || x.name == args.Charname)
			break
		case 'other':
			chat_log = chat_log.filter(x => x.name != args.UserCharname && x.name != args.Charname)
			break
	}
	return chat_log
}

/**
 * 扁平化聊天记录，将 `logContextBefore` 和 `logContextAfter` 合并到主日志中。
 * @param {chatLogEntry_t[]} chat_log - 要扁平化的聊天记录。
 * @returns {chatLogEntry_t[]} - 扁平化后的聊天记录。
 */
export function flatChatLog(chat_log) {
	return chat_log
		.map(chatLogEntry => [...chatLogEntry.logContextBefore || [], chatLogEntry, ...chatLogEntry.logContextAfter || []])
		.flatMap(x => x)
		.filter(entry => !entry.charVisibility || entry.charVisibility.includes(charname))
}

/**
 * 在聊天记录中匹配关键字。
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {(string|RegExp)[]} keys - 关键字数组。
 * @param {'any'|'user'|'char'|'other'} from - 按角色筛选。
 * @param {number} depth - 搜索深度。
 * @param {Function} [matcher] - 自定义匹配器函数。
 * @returns {Promise<number>} - 匹配到的关键字数量。
 */
export async function match_keys(args, keys, from = 'any', depth = 4,
	matcher = (content, reg_keys) => reg_keys.filter(key => content.match(key)).length
) {
	const chat_log = getScopedChatLog(args, from, depth)
	const contents = await Promise.all(chat_log.map(PreprocessChatLogEntry))

	let maxFetchCount = 0
	for (const key in contents[0]) {
		const content_list = contents.map(x => x[key])
		const content = content_list.join('\n')
		maxFetchCount = Math.max(maxFetchCount, base_match_keys(content, keys, matcher))
	}

	/*
	if (maxFetchCount) {
		console.log('args matching keys:', keys)
		console.log('result:', maxFetchCount)
	}
	//*/

	return maxFetchCount
}

/**
 * 检查聊天记录中是否包含所有指定的关键字。
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {(string|RegExp)[]} keys - 关键字数组。
 * @param {'any'|'user'|'char'|'other'} from - 按角色筛选。
 * @param {number} depth - 搜索深度。
 * @returns {Promise<boolean>} - 如果所有关键字都匹配到，则返回 true，否则返回 false。
 */
export async function match_keys_all(args, keys, from = 'any', depth = 4) {
	return await match_keys(args, keys, from, depth, (content, reg_keys) => reg_keys.every(key => content.match(key)))
}

/**
 * 计算聊天记录中关键字的出现次数。
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {(string|RegExp)[]} keys - 关键字数组。
 * @param {'any'|'user'|'char'|'other'} from - 按角色筛选。
 * @param {number} depth - 搜索深度。
 * @returns {Promise<number>} - 关键字出现的总次数。
 */
export async function match_keys_count(args, keys, from = 'any', depth = 4) {
	return await match_keys(args, keys, from, depth, (content, reg_keys) => reg_keys.map(key => content.match(key)?.length || 0).reduce((a, b) => a + b))
}
