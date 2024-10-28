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
export function FileSenderPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if(match_keys(args, ['发给我', '发我'], 'any'))
		result += `\
你可以用以下语法发送文件：
\`\`\`send-file
文件路径1
文件路径2
\`\`\`
如：
\`\`\`send-file
~/Desktop/test.txt
\`\`\`
将发送桌面下的test.txt文件
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}