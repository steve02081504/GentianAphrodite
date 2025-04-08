/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function NullReplayPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if (logical_results.in_muti_char_chat || args.extension?.from_timer)
		result += `\
你若认为当前语境不适合或无需回复，可以单纯输出<-<null>->来跳过回复。
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
