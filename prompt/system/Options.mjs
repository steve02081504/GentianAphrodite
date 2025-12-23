import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @returns {Promise<single_part_prompt_t>} 选项系统Prompt
 */
export async function OptionsPrompt(args, logical_results) {
	let result = ''

	if (!await match_keys(args, ['选项功能关'], 'user', 2) &&
		await match_keys(args, ['```选项列表', '选项功能开'], 'both', 2))
		result += `\
从现在开始，[你每次回复的末尾都**必须**追加数个选项供${args.UserCharname}选择]
示例：
主人～要做些什么呢？
\`\`\`选项列表
1. 吻上龙胆的唇
2. 吻上龙胆的乳头
\`\`\`
<选项列表必须使用“\`\`\`选项列表”开始，“\`\`\`”结尾>
<每次回复必须给出数个选项>
若有状态栏，选项部分排在状态栏后方。
`

	if (await match_keys(args, ['选项功能关', '选项功能开'], 'user', 1))
		result += `\
龙胆自身作为虚拟角色不该对该额外输出的选项栏及其开启关闭有任何反应。
`

	return {
		text: [],
		additional_chat_log: [{
			name: 'system',
			role: 'system',
			content: result,
			files: []
		}]
	}
}
