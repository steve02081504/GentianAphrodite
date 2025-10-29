import { findChineseExprs, findChineseExprsAndNumbers } from '../../scripts/chineseToNumber.mjs'
import { getScopedChatLog, match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @param {prompt_struct_t} prompt_struct 提示结构
 * @param {number} detail_level 细节等级
 * @returns {Promise<prompt_struct_t>} 返回的提示结构
 */
export async function AutoCalcPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	const getLog = () => getScopedChatLog(args, 'any').map(x => x.content).join()
	if (args.extension?.enable_prompts?.autocalc || await match_keys(args, [/((哪|那)个|谁)(最|)(大|小)/, /(大|小)还是/], 'any')) {
		const str = getLog().replace(/(:|@\w*|\/)\b\d+(?:\.\d+)?\b/g, '')
		const nums = findChineseExprsAndNumbers(str)
		if (Object.keys(nums).length >= 2)
			result += `\
以下是一些数的大小顺序，可能对你的回答有帮助：
${Object.entries(nums).sort((a, b) => a[1].compare(b[1])).map(([expr, value]) => `${expr}${expr == value ? '' : `（${value}）`}`).join('小于')}
`
	}
	if (args.extension?.enable_prompts?.autocalc || await match_keys(args, ['是多少', '是几', '算一下', '算下', '计算', /[=＝][?？]/], 'any')) {
		const exprs = findChineseExprs(getLog().replace(/(:|@\w*)\b\d+(?:\.\d+)?\b/g, '').replace(/\b(\d+)?d(\d+)([+-]\d+)?\b/g, ''))
		if (Object.keys(exprs).length) {
			const expr_result = Object.entries(exprs).map(([expr, value]) => `${expr} = ${value}`).filter(x => x.length < 1024).join('\n')
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
