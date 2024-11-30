import { NdiffResults, PickRandomN, random, repetRandomTimes, emptyForChance } from '../../scripts/random.mjs'
import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function RandEventPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if (Math.random() < 1 / 3 && !logical_results.talking_about_ai_character && !logical_results.in_assist)
		result += `\
允许发生正向或负面的随机事件增加趣味性。
随机事件应符合逻辑、生动、有创意、不重复。
`

	return {
		text: [],
		additional_chat_log: [{
			role: 'system',
			name: 'system',
			content: result,
			files: []
		}]
	}
}
