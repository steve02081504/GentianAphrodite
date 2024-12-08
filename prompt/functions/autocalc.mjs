import { NdiffResults, PickRandomN, random, repetRandomTimes, emptyForChance } from '../../scripts/random.mjs'
import { getScopedChatLog, match_keys } from '../../scripts/match.mjs'
import { findChineseExprs, findChineseExprsAndNumbers } from '../../scripts/chineseToNumber.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function AutoCalcPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	let getLog = () => getScopedChatLog(args, 'any').map(x => x.content).join()
	if (await match_keys(args, [/((哪|那)个|谁)(最|)(大|小)/, /(大|小)还是/], 'any')) {
		let str = getLog().replace(/(:|@\w*|\/)\b\d+(\.\d+)?\b/g, '')
		let nums = findChineseExprsAndNumbers(str)
		if (Object.keys(nums).length >= 2)
			result += `\
以下是一些数的大小顺序，可能对你的回答有帮助：
${Object.entries(nums).sort((a, b) => a[1].compare(b[1])).map(([expr, value]) => `${expr}${expr == value ? '' : `（${value}）`}`).join('小于')}
`
	}
	if (await match_keys(args, ['是多少', '是几', '算一下', '算下', /[=＝][?？]/], 'any')) {
		let exprs = findChineseExprs(getLog().replace(/(:|@\w*)\b\d+(\.\d+)?\b/g, '').replace(/\b(\d*)d(\d+)([+-]\d+)?\b/g, ''))
		if (Object.keys(exprs).length) {
			let expr_result = Object.entries(exprs).map(([expr, value]) => `${expr} = ${value}`).join('\n')
			result += `\
以下是一些计算结果，可能对你的回答有帮助：
${expr_result}
`
			if (expr_result.includes('['))
				result += `\
小数部分的中括号代表循环小数，如0.[34]表示0.343434...
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
