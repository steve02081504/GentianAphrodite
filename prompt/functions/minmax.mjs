import { NdiffResults, PickRandomN, random, repetRandomTimes } from '../../scripts/random.mjs'
import { getScopedChatLog, match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export function MinMaxPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if(match_keys(args, [/(哪个|谁)(最|)(大|小)/, /(大|小)还是/], 'any')) {
		let matches = getScopedChatLog(args, 'any').map(x => x.content).join().match(/\d+(\.\d+)?/g).map(x => parseFloat(x))
		if (matches.length)
			result += `\
以下是一些数，从小到大排列，可能对你的回答有帮助：
${matches.sort((a, b) => a - b).join(', ')}
`
	}
	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
