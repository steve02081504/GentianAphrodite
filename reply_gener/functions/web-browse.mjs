import { defineReplyHandler } from '../../../../../../../src/public/parts/shells/chat/src/reply/defineReplyHandler.mjs'
import { DeepResearchMainPrompt } from '../../prompt/functions/deep-research.mjs'
import { unlockAchievement } from '../../scripts/achievements.mjs'
import { statisticDatas } from '../../scripts/statistics.mjs'
import { MarkdownWebFetch } from '../../scripts/web/index.mjs'
import { OrderedAISourceCalling } from '../../service_sources/AI.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * 处理 `<web-browse>`：抓取网页并让 AI 回答针对网页的问题。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {Function} args.AddLongTimeLog 追加工具结果日志
 * @param {object} args.prompt_struct 提示词结构体
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function webBrowseHandle(reply, args, call) {
	const AddLongTimeLog = args.AddLongTimeLog
	const prompt_struct = args.prompt_struct
	const urlMatch = call.inner.match(/<url>(?<url>[\S\s]*?)<\/url>/)
	const questionMatch = call.inner.match(/<question>(?<question>[\S\s]*?)<\/question>/)
	const url = urlMatch?.groups?.url?.trim()
	if (!url || !questionMatch) return {}
	const question = questionMatch.groups.question.trim()

	try {
		unlockAchievement('use_webbrowse')
		statisticDatas.toolUsage.webBrowses++
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
					uid: 'system',
					role: 'system'
				},
				{
					content: `\
请仔细阅读网页内容，并回答以下问题：
${question}
`,
					name: 'system',
					uid: 'system',
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
	} catch (err) {
		AddLongTimeLog({
			name: 'web-browse',
			role: 'tool',
			content: '访问网页时出现错误：\n' + err,
			files: []
		})
	}
	return { regen: true }
}

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export const webbrowse = defineReplyHandler({
	tag: 'web-browse',
	handle: webBrowseHandle,
})
