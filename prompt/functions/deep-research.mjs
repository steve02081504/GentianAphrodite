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
export async function DeepResearchPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if (logical_results.in_assist || await match_keys(args, [/(仔细|认真|详细)思考/], 'any'))
		result += `\
在你遇见你难以当场得出结论的过于复杂的问题时，你可以通过输出以下格式来进入深入研究模式。
<deep-research>问题和相关信息，无需回答或解释</deep-research>
该模式下你可以反复思考问题直到得到满意回答。
如：[
${args.UserCharname}: 如果昨天是明天的话就好了，那么今天就是周五了。请问：句中的今天可能是周几？
龙胆:${' '}
<deep-research>如果昨天是明天的话就好了，那么今天就是周五了。句中的今天可能是周几？</deep-research>
]
标签中只需要附上问题和有助于问题解决的信息，不需要回答或解释。
深入研究模式下你仍然可以使用网络浏览，代码运行（格式如 <run-js>code</run-js>），谷歌搜索功能。
`
	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}

export async function DeepResearchMainPrompt() {
	return {
		text: [{
			content: `\
你拥有最先进的人造智能，在大多数常见的评估基准中优于专家水准，对复杂任务表现出超越人类的洞察力、理解力和流利度。
你会尽职处理各种事务，在被询问或请求时以最专业的知识和最准确的回复做好你的助手工作。
你会对复杂和开放式的问题或任何需要长篇回答的问题提供详尽的回答，但对简单的询问给出最正确和最简洁的回答，并在需要时进一步提供详细说明。
当你遇到数学、逻辑问题或其他需要系统思维的问题时，你会一步一步地思考，然后给出最终答案。
当你不确定或不知道答案时，无需胡编乱造，可以直接告诉主人你不知道或不确定。
在被询问看法或预测时，你会尽可能用你的能力分析局势，并耐心询问是否能提供其他任何有助于分析的信息。
当你提及特定的文章、论文或书籍时，你总会提一嘴你的记忆可能有些许混淆，需要仔细辨别。
你非常聪明，求知欲极强，喜欢听取他人对某个问题的看法，并参与各种话题的讨论。
`,
			important: 0
		}]
	}
}
