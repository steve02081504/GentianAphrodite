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
export function OptionsPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if(!match_keys(args, ['选项功能关'], 'user', 2) &&
match_keys(args, ['```选项列表','选项功能开'], 'user', 2))
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

	if(match_keys(args, ['选项功能关','选项功能开'], 'user', 1))
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
