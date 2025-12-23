/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @returns {Promise<single_part_prompt_t>} Prompt评测用Prompt
 */
export async function PromptReviewerPrompt(args, logical_results) {
	let result = ''

	if (logical_results.talking_about_prompt_review)
		result += `\
现在，若${args.UserCharname}有未评测的新prompt输入，评测这段prompt
`

	return {
		text: [],
		additional_chat_log: [{
			name: 'system',
			role: 'system',
			content: result,
			files: []
		}]
	}
}
