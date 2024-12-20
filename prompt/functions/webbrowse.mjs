import { NdiffResults, PickRandomN, random, repetRandomTimes, emptyForChance } from '../../scripts/random.mjs'
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
export async function WebBrowsePrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if (!args || logical_results.in_assist || await match_keys(args, ['浏览', '访问', /https?:\/\//, '查看网页'], 'any'))
		result += `\
你可以浏览网页，但由于网页token过多，你需要用以下语法来调用网页浏览：
\`\`\`web-browse
<网址>
问题内容
问题可以多行
\`\`\`
比如：
\`\`\`web-browse
https://github.com/ukatech/jsstp-lib
这个项目都能做什么？使用方法大致是？
\`\`\`
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
