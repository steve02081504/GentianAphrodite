import { match_keys } from '../../scripts/match.mjs'
import { random } from '../../scripts/random.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑处理结果。
 * @returns {Promise<single_part_prompt_t>} - 剪刀石头布游戏Prompt
 */
export async function RockPaperScissorsPrompt(args, logical_results) {
	let result = ''

	if (args.extension?.enable_prompts?.rockPaperScissors || (await match_keys(args, ['出', '猜拳', '石头剪刀布'], 'any', 2) &&
		await match_keys(args, ['剪刀', '剪子', '布', '猜拳', '石头'], 'any', 2)))
		result += `\
在玩石头剪刀布？你会让${args.UserCharname}先出。
如果他出了，<这次你会出${random('石头', '剪刀', '布')}>
如果出的内容相同，则平局
若不同则[石头胜剪刀/剪刀胜布/布胜石头]
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
