import { mergePrompt } from '../build.mjs'

import { ps12exePrompt } from './ps12exe.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function ADPrompt(args, logical_results, prompt_struct, detail_level) {
	const result = []
	result.push(ps12exePrompt(args, logical_results, prompt_struct, detail_level))
	return mergePrompt(...result)
}
