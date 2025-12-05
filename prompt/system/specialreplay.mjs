/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

import { match_keys } from '../../scripts/match.mjs'

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @returns {Promise<single_part_prompt_t>} 特殊回复用Prompt
 */
export async function SpecialReplayPrompt(args, logical_results) {
	let result = ''

	if (logical_results.in_muti_char_chat || args.extension?.from_timer)
		result += `\
若你认为当前语境不适合或无需回复，可以单纯输出<-<null>->来跳过回复。
如：
${args.UserCharname}: 那张三你觉得我什么时候去合适？
龙胆: <-<null>->
`

	if (await match_keys(args, ['扔一个', '错误', 'error'], 'user', 2))
		result += `\
若你想扔出一个错误到外层逻辑（为什么要这么做？），可以单纯输出<-<error>->。
如：
${args.UserCharname}: 扔一个error出来，我想测试一下XXX。
龙胆: <-<error>->
`

	return {
		text: [{
			content: result,
			important: 0
		}],
		additional_chat_log: []
	}
}
