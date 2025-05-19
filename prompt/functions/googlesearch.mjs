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

	if (!args || logical_results.in_assist || await match_keys(args, ['搜索', '查找', '查询', /(查|搜|搜索).{0,3}下/, /有(哪些|什么|没有)/, '怎样', '如何', '帮我搜'], 'any'))
		result += `\
你可以用以下语法进行谷歌搜索（如果需要同时搜索多个主题，请每个主题占一行）：
<google-search>
关键词列表1
关键词列表2
</google-search>
如：
<google-search>
Node.js documentation
</google-search>
将返回搜索结果摘要。
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
