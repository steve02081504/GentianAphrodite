/** @typedef {import('../../../../../../src/public/shells/chat/decl/chatLog').chatReplyRequest_t} chatReplyRequest_t */
import { escapeRegExp } from './tools.mjs'

/**
 * Return a subset of chat_log, scoped by depth and role
 * @param {chatReplyRequest_t} args
 * @param {'user'|'char'|'both'|'other'} [from='any'] filter by role
 * @param {number} [depth=4] number of entries to return
 * @return {chatLogEntry_t[]} the scoped chat log
 */
export function getScopedChatLog(args , from='any', depth = 4) {
	// pickup the last few entry of chat_log
	let chat_log = args.chat_log.slice(-depth)
	// filter roles
	switch (from) {
		case 'user':
			chat_log = chat_log.filter(x => x.name == args.UserCharname)
			break
		case 'char':
			chat_log = chat_log.filter(x => x.name == args.Charname)
			break
		case 'both':
			chat_log = chat_log.filter(x => x.name == args.UserCharname && x.name == args.Charname)
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
export function match_keys(args, keys, from = 'any', depth = 4,
	matcher = (content, reg_keys) => reg_keys.filter(key => content.match(key)).length
) {
	let chat_log = getScopedChatLog(args, from, depth)

	// convert all keys to regexp, if it's have chinese like character, no match hole word
	keys = keys.map(key =>
		key instanceof RegExp ? key :
		new RegExp(/\p{Unified_Ideograph}/u.test(key) ? escapeRegExp(key) : `\\b${escapeRegExp(key)}\\b`, 'ugi'))

	let content = chat_log.map(x => x.content).join('\n')

	return matcher(content, keys)
}

export function match_keys_all(args, keys, from = 'any', depth = 4) {
	return match_keys(args, keys, from, depth, (content, reg_keys) => reg_keys.every(key => content.match(key)))
}
