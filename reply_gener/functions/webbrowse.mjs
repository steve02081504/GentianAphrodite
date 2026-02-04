import { OrderedAISourceCalling } from '../../AISource/index.mjs'
import { DeepResearchMainPrompt } from '../../prompt/functions/deep-research.mjs'
import { unlockAchievement } from '../../scripts/achievements.mjs'
import { statisticDatas } from '../../scripts/statistics.mjs'
import { MarkdownWebFetch } from '../../scripts/web.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export async function webbrowse(result, { AddLongTimeLog, prompt_struct }) {
	const matches = [...result.content.matchAll(/<web-browse>\s*<url>(?<url>.*?)<\/url>\s*<question>(?<question>[\S\s]*?)<\/question>\s*<\/web-browse>/g)]
	const validMatches = matches.filter(m => m?.groups?.url !== undefined)
	if (!validMatches.length) return false

	// 合并为一条角色消息，鼓励一次回复中多次浏览
	AddLongTimeLog({
		name: '龙胆',
		role: 'char',
		content: validMatches.map(m => m[0]).join('\n'),
		files: []
	})

	let processed = false
	for (const match of validMatches) try {
		unlockAchievement('use_webbrowse')
		statisticDatas.toolUsage.webBrowses++
		const url = match.groups.url.trim()
		const question = match.groups.question.trim()
		const markdown = await MarkdownWebFetch(url)

		console.info('AI浏览网页：', url)
		console.info('网页内容：')
		console.dir(markdown)

		const browsing = {
			...prompt_struct,
			char_prompt: await DeepResearchMainPrompt(),
			other_chars_prompt: {},
			world_prompt: {
				text: [],
				additional_chat_log: [],
				extension: {}
			},
			plugin_prompts: {},
			chat_log: [
				{
					content: `\
网页内容：
${markdown}
`,
					name: 'system',
					role: 'system'
				},
				{
					content: `\
请仔细阅读网页内容，并回答以下问题：
${question}
`,
					name: 'system',
					role: 'system'
				}
			]
		}
		const browseResult = await OrderedAISourceCalling('web-browse', AI => AI.StructCall(browsing))
		AddLongTimeLog({
			content: '浏览结果：\n' + browseResult.content,
			name: 'web-browse',
			role: 'tool'
		})
		processed = true
	} catch (err) {
		AddLongTimeLog({
			name: 'web-browse',
			role: 'tool',
			content: '访问网页时出现错误：\n' + err,
			files: []
		})
		processed = true
	}
	return processed
}
