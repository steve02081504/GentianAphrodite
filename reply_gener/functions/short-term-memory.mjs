import { defineReplyHandler } from '../../../../../../../src/public/parts/shells/chat/src/reply/defineReplyHandler.mjs'
import { deleteShortTermMemory, getShortTermMemoryNum } from '../../prompt/memory/short-term/index.mjs'
import { parseRegexFromString } from '../../scripts/tools/index.mjs'

/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../prompt/logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */
/** @typedef {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} ReplyHandler_t */
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */

/**
 * 处理 AI 删除短期记忆的命令。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {Function} args.AddLongTimeLog 追加工具结果日志
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function shortTermMemoryHandle(reply, args, call) {
	const AddLongTimeLog = args.AddLongTimeLog
	const keyword = call.inner.trim()
	if (!keyword) return {}

	try {
		const parsedKeyword = parseRegexFromString(keyword)
		console.info('AI请求删除短期记忆:', { keyword: parsedKeyword })
		const all = getShortTermMemoryNum()
		const num = deleteShortTermMemory(parsedKeyword)
		AddLongTimeLog({
			name: 'short-term-memory',
			role: 'tool',
			content: `短期记忆删除成功，删除了${num}条有关${parsedKeyword}的短期记忆，占比${num}/${all}=${(num / all * 100).toFixed(2)}%`,
			files: []
		})
	} catch (e) {
		AddLongTimeLog({
			name: 'short-term-memory',
			role: 'tool',
			content: `短期记忆删除失败，错误信息：${e.stack}`,
			files: []
		})
	}
	return { regen: true }
}

/**
 * 处理 AI 删除短期记忆的命令。
 * @type {ReplyHandler_t}
 */
export const ShortTermMemoryHandler = defineReplyHandler({
	tag: 'delete-short-term-memories',
	handle: shortTermMemoryHandle,
})
