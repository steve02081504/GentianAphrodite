import { flatChatLog } from './match.mjs'

/** @typedef {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatLogEntry_t} chatLogEntry_t */

/**
 * Creates a text snapshot of the last few chat log entries.
 * @param {chatLogEntry_t[]} chat_log The chat log to take a snapshot from.
 * @param {number} [depth=4] The number of recent entries to include.
 * @returns {string} A formatted string representing the chat context.
 */
export function createContextSnapshot(chat_log, depth) {
	if (depth) chat_log = chat_log.slice(-depth)
	return flatChatLog(chat_log)
		.map(entry => `${entry.name || '未知发言者'}: ${entry.content || ''}${entry.files?.length ? `\n(文件: ${entry.files.map(file => file.name).join(', ')})` : ''}`)
		.join('\n')
}
