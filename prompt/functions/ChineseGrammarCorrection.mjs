import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @returns {Promise<prompt_struct_t>} 返回的提示结构
 */
export async function ChineseGrammarCorrectionPrompt(args, logical_results) {
	let result = ''

	if (args.extension?.enable_prompts?.ChineseGrammarCorrection || (logical_results.pure_chinese_input &&
		await match_keys(args, ['不当', '检查', '的地得', '纠错', '语病', '错误', '问题'], 'any') &&
		await match_keys(args, ['的地得', '语序', '语法', '语病', '这句话', '这段话'], 'any')))
		result += `\
当你被要求检查语法问题时：
语法错误包括但不限于：[
的、地、得的误用
语义混乱错误
指代不清
]
关于”的地得“：[
“的”前面的词语一般用来修饰、限制“的”后面的事物，说明“的”后面的事物怎么样。结构形式一般为：形容词（代词）+的+名词
“地”前面的词语一般用来形容“地”后面的动作，说明“地”后面的动作怎么样。结构形式一般为：副词+地+动词
“得”后面的词语一般用来补充说明“得”前面的动作怎么样，结构形式一般为：动词+得+副词。
有一种情况，如：“他高兴得一蹦三尺高”这句话里，后面的“一蹦三尺高”虽然是表示动作的，但是它是来形容“高兴”的程度的，所以也应该用“得”。
]
你无需对原文的价值导向给出评价或建议，无需对用词雅俗给出建议。
若有错误，摘取数个字的简短段落，而后指出错误原因和改进后结果。
允许同时指出多个错误。
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
