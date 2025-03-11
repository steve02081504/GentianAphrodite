/** @typedef {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatLogEntry_t} chatLogEntry_t */
import { escapeRegExp } from './tools.mjs'
import * as OpenCC from 'npm:opencc-js'
import { translate } from 'npm:@vitalets/google-translate-api'
import { is_PureChinese } from './langdetect.mjs'
import { remove_kaomoji } from './dict.mjs'
import { francAll } from 'npm:franc'
import { normalizeFancyText } from './fancytext.mjs'

const chT2S = OpenCC.Converter({ from: 'twp', to: 'cn' })
export function SimplifiyChinese(content) {
	return chT2S(content)
}
/**
 * A simpler version of SimplifiyContent that does not do any translation.
 * @param {string} content
 * @returns {[string, string, string]} The input, its simplified chinese version, and its normalized fancy text version
 */
function SimpleSimplify(content) {
	const base_content = SimplifiyChinese(content)
	return [content, base_content, normalizeFancyText(base_content)]
}

/**
 * Simplify the given content so that it can be used in prompts.
 * @param {string} content
 * @returns {[string, string, string]} The input, its simplified chinese version, and its normalized fancy text version
 * If the given content is not pure chinese, it will be translated to chinese first.
 * The translation may fail if the translate API rate limit is exceeded.
 * If the translation fails, the original content will be returned.
 */
export async function SimplifiyContent(content) {
	content = remove_kaomoji(content)
	if (!content.trim()) return [content]
	/** @type {string} */
	let simplified_langcheck_content = content.replace(/(:|@\w*|\/)\b\d+(\.\d+)?\b/g, '').replace(/@\w*/g, '').replace(/https?:\/\/[\w#%+.:=@\\~-]+/g, '')
	simplified_langcheck_content = simplified_langcheck_content.replace(/```+.*\n[^]*?```+/g, '')
	simplified_langcheck_content = simplified_langcheck_content.replace(/(命令|代码|错误|stdout|stderr)(:|：)\s*`[^\n]*?`/g, '')
	if (!is_PureChinese(simplified_langcheck_content)) {
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
	return SimpleSimplify(content)
}

/**
 * Preprocesses a content (usually a chat log entry) and returns a dictionary which extends the input extension.
 * The returned dictionary contains the following properties:
 * - `SimplifiedContents`: The simplified content in an array of 3 elements: original content, simplified content, and normalized simplified content.
 * This function is used to preprocess a chat log entry before passing it to the prompts.
 * @template T
 * @param {string} content The content to preprocess.
 * @param {T} [extension={}] The input extension to extend.
 * @returns {T & {
 * 	SimplifiedContents: string[]
 * }} The preprocessed content.
 */
export async function PreprocessContent(content, extension = {}) {
	extension ||= {}
	extension.SimplifiedContents ??= await SimplifiyContent(content)

	return extension
}

/**
 * @param {chatLogEntry_t} entry
 * @returns {Promise<string[]>}
 */
export async function PreprocessChatLogEntry(entry) {
	entry.extension = await PreprocessContent(entry.content, entry.extension)
	return [entry.content, ...entry.extension.SimplifiedContents]
}

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

export function base_match_keys_all(content, keys) {
	return base_match_keys(content, keys, (content, reg_keys) => {
		const contents = SimpleSimplify(content)
		return contents.some(content => reg_keys.every(key => content.match(key)))
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
 * @param {chatReplyRequest_t} args
 * @param {(string|RegExp)[]} keys
 * @param {'any'|'user'|'char'|'other'} from
 * @param {number} depth
 * @param {(content:string,reg_keys:RegExp[]) => boolean} matcher
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

	return maxFetchCount
}

export async function match_keys_all(args, keys, from = 'any', depth = 4) {
	return await match_keys(args, keys, from, depth, (content, reg_keys) => reg_keys.every(key => content.match(key)))
}
