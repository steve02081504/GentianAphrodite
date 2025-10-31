/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @returns {Promise<single_part_prompt_t>} 空回复用Prompt
 */
export async function NullReplayPrompt(args, logical_results) {
	let result = ''

	if (logical_results.in_muti_char_chat || args.extension?.from_timer)
		result += `\
若你认为当前语境不适合或无需回复，可以单纯输出<-<null>->来跳过回复。
如：
${args.UserCharname}: 那张三你觉得我什么时候去合适？
龙胆: <-<null>->
`

	return {
		text: [{
			content: result,
			important: 0
		}],
		additional_chat_log: []
	}
}
