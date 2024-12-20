/** @typedef {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatLogEntry_t} chatLogEntry_t */
import { escapeRegExp } from './tools.mjs'
import * as OpenCC from 'npm:opencc-js'
import { translate } from 'npm:@vitalets/google-translate-api'
import { is_PureChinese } from './langdetect.mjs'
import { remove_kaomoji } from './dict.mjs'
import { francAll } from 'npm:franc'
import { normalizeFancyText } from './fancytext.mjs'

let chT2S = OpenCC.Converter({ from: 'twp', to: 'cn' })
export function SimplifiyChinese(content) {
	return chT2S(content)
}
function SimpleSimplify(content) {
	return [...new Set([...SimplifiyChinese(content).split('\n'), ...normalizeFancyText(content).split('\n')])].join('\n')
}

export async function SimplifiyContent(content) {
	content = remove_kaomoji(content)
	if (!content.trim()) return content
	if (!is_PureChinese(content)) {
		console.info('%ccontent "' + content + '" is not pure chinese, translating it for prompt building logic', 'color: red')
		console.log('franc result:', francAll(content, { minLength: 0 }))
		while (true)
			try {
				content = (await translate(content, { from: 'auto', to: 'zh-CN' })).text
				break
			} catch (e) {
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
	content = SimpleSimplify(content)
	return content
}

export async function PreprocessContent(content, extension = {}) {
	extension ||= {}
	extension.SimplifiedContent ??= await SimplifiyContent(content)

	return extension
}

export async function PreprocessChatLogEntry(entry) {
	entry.extension = await PreprocessContent(entry.content, entry.extension)
	return [...new Set([...entry.extension.SimplifiedContent.split('\n'), ...entry.content.split('\n')])].join('\n')
}

export function base_match_keys(content, keys,
	matcher = (content, reg_keys) => {
		content = SimpleSimplify(content)
		return reg_keys.filter(key => content.match(key)).length
	}
) {
	// convert all keys to regexp, if it's have chinese like character, no match hole word
	keys = keys.map(key =>
		key instanceof RegExp ? key :
			new RegExp(/\p{Unified_Ideograph}/u.test(key) ? escapeRegExp(key) : `\\b${escapeRegExp(key)}\\b`, 'ugi'))

	return matcher(content, keys)
}

export function base_match_keys_all(content, keys) {
	return base_match_keys(content, keys, (content, reg_keys) => {
		content = SimpleSimplify(content)
		return reg_keys.every(key => content.match(key))
	})
}

/**
 * Return a subset of chat_log, scoped by depth and role
 * @param {chatReplyRequest_t} args
 * @param {'user'|'char'|'both'|'other'} [from='any'] filter by role
 * @param {number} [depth=4] number of entries to return
 * @return {chatLogEntry_t[]} the scoped chat log
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
 * @param {chatReplyRequest_t} args
 * @param {(string|RegExp)[]} keys
 * @param {'any'|'user'|'char'|'other'} from
 * @param {number} depth
 * @param {(content:string,reg_keys:RegExp[]) => boolean} matcher
 */
export async function match_keys(args, keys, from = 'any', depth = 4,
	matcher = (content, reg_keys) => reg_keys.filter(key => content.match(key)).length
) {
	let chat_log = getScopedChatLog(args, from, depth)
	let content = (await Promise.all(chat_log.map(PreprocessChatLogEntry))).join('\n')

	return base_match_keys(content, keys, matcher)
}

export async function match_keys_all(args, keys, from = 'any', depth = 4) {
	return await match_keys(args, keys, from, depth, (content, reg_keys) => reg_keys.every(key => content.match(key)))
}
