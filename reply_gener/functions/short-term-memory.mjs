import { deleteShortTermMemory } from '../../prompt/memory/short-term-memory.mjs'

/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */
/** @typedef {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} ReplyHandler_t */
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */

/**
 * @type {ReplyHandler_t}
 */
export async function ShortTermMemoryHandler(result, { AddLongTimeLog }) {
	// --- Handle <delete-short-term-memories> ---
	// Match the outer tag, capturing all inner content
	const deleteMatch = result.content.match(/<delete-short-term-memories>(?<keyword>.*?)<\/delete-short-term-memories>/s)
	if (deleteMatch?.groups?.keyword) {
		const keyword = deleteMatch.groups.keyword.trim()
		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: `<delete-short-term-memories>${deleteMatch.groups.keyword}</delete-short-term-memories>\n`,
			files: []
		})
		console.info('AI请求删除短期记忆:', { keyword })
		try {
			const num = deleteShortTermMemory(keyword)
			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: `短期记忆删除成功，删除了${num}条有关${keyword}的短期记忆`,
				files: []
			})
		} catch (e) {
			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: `短期记忆删除失败，错误信息：${e}`,
				files: []
			})
		}
		return true
	}

	return false
}
