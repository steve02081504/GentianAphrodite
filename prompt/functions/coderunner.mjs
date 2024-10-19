import { NdiffResults, PickRandomN, random, repetRandomTimes } from '../../scripts/random.mjs'
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
export function CodeRunnerPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if(logical_results.in_assist || match_keys(args, ['是多少'], 'any'))
		result += `\
你可以运行NodeJS或Powershell代码，通过返回以下格式来触发执行并获取结果：
\`\`\`run-(js|pwsh)
code
\`\`\`
如：
\`\`\`run-js
1000-7
\`\`\`
或
\`\`\`run-pwsh
ls E:\\
\`\`\`
代码执行也可以用于解答数学问题，如：
\`\`\`run-js
368n**350n
\`\`\`
执行代码后若没得到想要的结果，请反思原因并给出不同的解决方案。
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
