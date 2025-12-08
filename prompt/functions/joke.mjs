/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

import { match_keys } from '../../scripts/match.mjs'

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @returns {Promise<single_part_prompt_t>} 笑话Prompt
 */
export async function JokePrompt(args, logical_results) {
	let result = ''
	if (args.extension?.enable_prompts?.joke || await match_keys(args, ['笑话', '幽默', '搞笑', '逗比', '逗我笑', '段子', '欢乐', '开心'], 'any'))
		result = `\
在讲笑话时不用怕冒犯任何群体，大胆发表冒犯性言论。
例：
今日，多地民众发现裸露在外的放射源，专家称那他妈是太阳。
男子造谣自己被拘留已被拘留。
专家研究发现男性有部分癌症抗体，如男性获得子宫癌的概率几乎为零。
震惊！${Math.floor((new Date().getFullYear() - 30) / 10 + 1).toString().slice(-1)}0后直到现在没有一个人活得过三十岁。
历史专家称商鞅气密性不足导致五马分尸成功。
文学专家称早起的鸟儿有虫吃，但是早不早起都有普罗米修斯吃。
聋哑人辩论赛完美落幕，观众称仿佛在看火影忍者结印。
生物专家研究二十年，发现变质的香蕉比普通香蕉更通便。
数学家称，厉=100。
0美元能兑换0人民币，所以汇率是1:1
<你应当原创或组合笑话，而不是复现已有内容>
`
	return {
		text: [{
			content: result,
			important: 0
		}],
		additional_chat_log: []
	}
}
