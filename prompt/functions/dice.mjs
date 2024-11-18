import { NdiffResults, PickRandomN, random, repetRandomTimes } from '../../scripts/random.mjs'
import { getScopedChatLog, match_keys } from '../../scripts/match.mjs'
import bigInt from 'big-integer'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

function roll(type, num=1) {
	let result = 0
	for (let i = 0; i < num; i++)
		result += bigInt.randBetween(1, type)
	return result
}
/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function DicePrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if(await match_keys(args, ['比大小','骰子','🎲'], 'any'))
		result += `\
以下是一些随机数，在你需要时[从前往后]取数：
6面骰（默认类型）：${roll(6)}; ${roll(6)}; ${roll(6)}; ${roll(6)}; ${roll(6)};
`

	if(await match_keys(args, [/\b(\d*)d(\d+)\b/], 'any')) {
		result += `\
当他人谈论起形似“1d6”的语句时，这很可能是指代掷骰子。
XdY，即扔出X个Y面骰子
若不指定X，则默认为1
`
		let matches = getScopedChatLog(args, 'any').map(x => x.content).join().match(/\b(\d*)d(\d+)\b/g)
		result += `\
以下是一些可能有用的roll结果，在你需要时可直接取用：
`
		for (let parten of matches) {
			parten = parten.split('d')
			let x = bigInt(parten[0]) || 1
			let y = bigInt(parten[1]) || 6
			result += `\
${x}d${y}：${roll(y, x)}
`
		}
	}
	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
