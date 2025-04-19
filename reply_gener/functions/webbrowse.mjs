import { OrderedAISourceCalling } from '../../AISource/index.mjs'
import { DetailThinkingMainPrompt } from '../../prompt/functions/detail-thinking.mjs'
import { MarkdownWebFetch } from '../../scripts/web.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export async function webbrowse(result, { AddLongTimeLog, prompt_struct }) {
	const match = result.content.match(/<web-browse>\s*<url>(?<url>.*?)<\/url>\s*<question>(?<question>[\S\s]*?)<\/question>\s*<\/web-browse>/)

	if (match?.groups) {
		const url = match.groups.url.trim()
		const question = match.groups.question.trim()

		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: match[0],
			files: []
		})

		try {
			const markdown = await MarkdownWebFetch(url)

			console.info('AI浏览网页：', url)
			console.info('网页内容：')
			console.dir(markdown)

			const browseing = {
				...prompt_struct,
				char_prompt: await DetailThinkingMainPrompt(),
				other_chars_prompt: {},
				world_prompt: {
					text: [],
					additional_chat_log: [],
					extension: {}
				},
				plugin_prompts: {},
				chat_log: []
			}
			browseing.char_prompt.additional_chat_log = [
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
			const browseResult = await OrderedAISourceCalling('web-browse', AI => AI.StructCall(browseing)) // Renamed result variable to avoid shadowing
			AddLongTimeLog({
				content: '浏览结果：\n' + browseResult.content,
				name: 'system',
				role: 'system'
			})
		} catch (err) {
			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: '访问网页时出现错误：\n' + err,
				files: []
			})
		}
		return true
	}

	return false
}
