import { mergePrompt } from '../build.mjs'

import { ps12exePrompt } from './ps12exe.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * 生成广告相关的 Prompt。
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑结果。
 * @returns {Promise<object>} - 合并后的 Prompt 对象。
 */
export async function ADPrompt(args, logical_results) {
	const result = []
	result.push(ps12exePrompt(args, logical_results))
	return mergePrompt(...result)
}
