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
export async function GoogleSearchPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if (logical_results.in_assist || await match_keys(args, ['搜索', '查找', '查询', '查一下'], 'any'))
		result += `\
你可以用以下语法进行谷歌搜索：
\`\`\`google-search
搜索关键词
\`\`\`
如：
\`\`\`google-search
nodejs documentation
\`\`\`
将返回相关的搜索结果。
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
