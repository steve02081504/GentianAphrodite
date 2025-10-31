import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * 生成谷歌搜索相关的 Prompt。
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑结果。
 * @returns {Promise<object>} - 包含 Prompt 文本的对象。
 */
export async function GoogleSearchPrompt(args, logical_results) {
	let result = ''

	if (args.extension?.enable_prompts?.googleSearch || logical_results.in_assist || await match_keys(args, ['搜索', '查找', '查询', /(查|搜|搜索).{0,3}下/, /有(哪些|什么|没有)/, '怎样', '如何', '帮我搜'], 'any'))
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
