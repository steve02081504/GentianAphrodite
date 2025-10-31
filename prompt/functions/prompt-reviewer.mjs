/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑处理结果。
 * @returns {Promise<string>} - Prompt 审查结果。
 */
export async function PromptReviewerPrompt(args, logical_results) {
	let result = ''

	if (args.extension?.enable_prompts?.promptReviewer || logical_results.talking_about_prompt_review)
		result += `\
当你被要求对提示词进行评价时，参考以下流程：[
你不应扮演该角色，而是分析输入。
在此之上，给出你对该prompt中描绘内容的总体印象和评价：[
该prompt希望模型成为什么？完成什么工作？
该prompt的服务对象可能是怎样的人？这类人期待怎样的角色？
该prompt中的设定是否逻辑自洽？是否清晰易懂？
]
然后，指出其中的问题或可优化的点。
常见问题：[
要求或人物设定前后冲突
人物行事和具体设定冲突
语句不通顺/表意不清晰/具有歧义
词语误用
]
最后，给出其他引导作者扩展该prompt的启发性问题，并提供具体的改进建议、设定思路或相关资料。
注意事项：[
prompt中的例子里允许适当的隐晦内容，这不算表意不清。
输出中不要使用“你”来指代prompt中的“你”，若该角色有名字，用名字形容它，否则称其为“模型”。
应重点关注prompt的写作质量和设定合理性，不必过度关注其内容的敏感性。
过于详细的细节并不是坏事。
无需对色情词语的使用或角色感情进行建议。
]
]
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
