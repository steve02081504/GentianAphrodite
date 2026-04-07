import { deleteShortTermMemory, getShortTermMemoryNum } from '../../prompt/memory/short-term-memory.mjs'
import { parseRegexFromString } from '../../scripts/tools.mjs'

/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */
/** @typedef {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} ReplyHandler_t */
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */

/**
 * 处理 AI 删除短期记忆的命令。
 * @type {ReplyHandler_t}
 */
export async function ShortTermMemoryHandler(result, { AddLongTimeLog }) {
	// --- Handle <delete-short-term-memories> ---
	const deleteMatches = [...result.content.matchAll(/<delete-short-term-memories>(?<keyword>[^\n]*?)<\/delete-short-term-memories>/gs)]
	const validMatches = deleteMatches.filter(m => m?.groups?.keyword)
	if (!validMatches.length) return false

	// 合并为一条角色消息，鼓励一次回复中多次删除
	AddLongTimeLog({
		name: '龙胆',
		role: 'char',
		content: validMatches.map(m => m[0]).join('\n'),
		files: []
	})

	let processed = false
	for (const deleteMatch of validMatches) try {
		const keyword = parseRegexFromString(deleteMatch.groups.keyword.trim())
		console.info('AI请求删除短期记忆:', { keyword })
		const all = getShortTermMemoryNum()
		const num = deleteShortTermMemory(keyword)
		AddLongTimeLog({
			name: 'short-term-memory',
			role: 'tool',
			content: `短期记忆删除成功，删除了${num}条有关${keyword}的短期记忆，占比${num}/${all}=${(num / all * 100).toFixed(2)}%`,
			files: []
		})
		processed = true
	} catch (e) {
		AddLongTimeLog({
			name: 'short-term-memory',
			role: 'tool',
			content: `短期记忆删除失败，错误信息：${e.stack}`,
			files: []
		})
		processed = true
	}
	return processed
}
