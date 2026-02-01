import { Buffer } from 'node:buffer'
import util from 'node:util'

import {
	getConnectedPages,
	getFocusedPageInfo,
	getMostRecentPageInfo,
	getBrowseHistory,
	getPageHtml,
	getVisibleHtml,
	runJsOnPage,
	addAutoRunScript,
	removeAutoRunScript,
	listAutoRunScripts,
	updateAutoRunScript,
	sendDanmakuToPage
} from '../../../../../../../src/public/parts/shells/browserIntegration/src/api.mjs'
import { charname } from '../../charbase.mjs'
import { unlockAchievement } from '../../scripts/achievements.mjs'
import { UseNotifyAbleChannel } from '../../scripts/notify.mjs'
import { statisticDatas, newCharReply } from '../../scripts/statistics.mjs'
import { GetReply } from '../index.mjs'

/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * 处理浏览器集成命令。
 * @param {prompt_struct_t} result - 包含AI回复内容和扩展信息的对象。
 * @param {object} args - 包含处理回复所需参数的对象。
 * @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t}
 */
export async function browserIntegration(result, args) {
	const { AddLongTimeLog, username } = args
	let processed = false
	const commands_called = []

	/**
	 * 处理浏览器集成命令执行期间发生的错误。
	 * @param {Error} err - 抛出的错误对象。
	 * @param {string} command - 尝试执行的命令的名称。
	 * @param {string} [details=''] - 有关错误的任何其他详细信息。
	 */
	const handleError = (err, command, details = '') => {
		console.error(`Error executing browser integration command "${command}"${details}:`, err)
		AddLongTimeLog({
			name: 'browser-integration',
			role: 'tool',
			content: `执行 ${command} 时出错：\n${err.stack || err.message || err}`,
			files: []
		})
	}

	/**
	 * 将页面 ID（可能是 'focused'）解析为数字 ID。
	 * @param {string} pageIdRaw - 原始页面 ID 字符串。
	 * @returns {number} - 解析后的数字页面 ID。
	 */
	const resolvePageId = (pageIdRaw) => {
		if (pageIdRaw.toLowerCase() === 'focused') {
			const focusedPage = getFocusedPageInfo(username)
			if (focusedPage) return focusedPage.id
			throw new Error('没有找到焦点页面。')
		}
		if (pageIdRaw.toLowerCase() === 'mostrecent') {
			const mostRecentPage = getMostRecentPageInfo(username)
			if (mostRecentPage) return mostRecentPage.id
			throw new Error('没有找到最近访问的页面。')
		}
		return Number(pageIdRaw)
	}

	/**
	 * @type {Array<{name: string, regex: RegExp, handler: (match: RegExpMatchArray) => Promise<void>}>}
	 */
	const commandProcessors = [
		{
			name: 'get-connected-pages',
			regex: /<browser-get-connected-pages>\s*<\/browser-get-connected-pages>/g,
			/**
			 * 处理获取已连接页面列表的命令。
			 */
			handler: async () => {
				const pages = getConnectedPages(username)
				AddLongTimeLog({
					name: 'browser-integration',
					role: 'tool',
					content: '已连接的页面列表：\n' + util.inspect(pages, { depth: 4 }),
					files: []
				})
			}
		},
		{
			name: 'get-focused-page-info',
			regex: /<browser-get-focused-page-info>\s*<\/browser-get-focused-page-info>/g,
			/**
			 * 处理获取焦点页面信息的命令。
			 */
			handler: async () => {
				const page = getFocusedPageInfo(username)
				AddLongTimeLog({
					name: 'browser-integration',
					role: 'tool',
					content: '当前焦点页面信息：\n' + util.inspect(page, { depth: 4 }),
					files: []
				})
			}
		},
		{
			name: 'get-browse-history',
			regex: /<browser-get-browse-history>\s*<\/browser-get-browse-history>/g,
			/**
			 * 处理获取浏览历史的命令。
			 */
			handler: async () => {
				const history = getBrowseHistory(username)
				AddLongTimeLog({
					name: 'browser-integration',
					role: 'tool',
					content: '浏览历史：\n' + util.inspect(history, { depth: 4 }),
					files: []
				})
			}
		},
		{
			name: 'get-page-html',
			regex: /<browser-get-page-html>\s*<pageId>(.*?)<\/pageId>\s*<\/browser-get-page-html>/gs,
			/**
			 *
			 * @param {RegExpMatchArray} match - 匹配对象，包含捕获组。
			 */
			handler: async (match) => {
				const pageId = resolvePageId(match[1].trim())
				const html = await getPageHtml(username, pageId)
				AddLongTimeLog({
					name: 'browser-integration',
					role: 'tool',
					content: `页面 ${pageId} 的HTML内容已作为文件附件。`,
					files: [{ name: `page-${pageId}.html`, buffer: Buffer.from(html.html, 'utf-8'), mime_type: 'text/html' }]
				})
			}
		},
		{
			name: 'get-visible-html',
			regex: /<browser-get-visible-html>\s*<pageId>(.*?)<\/pageId>\s*<\/browser-get-visible-html>/gs,
			/**
			 *
			 * @param {RegExpMatchArray} match - 匹配对象，包含捕获组。
			 */
			handler: async (match) => {
				const pageId = resolvePageId(match[1].trim())
				const html = await getVisibleHtml(username, pageId)
				AddLongTimeLog({
					name: 'browser-integration',
					role: 'tool',
					content: `页面 ${pageId} 的可见HTML内容：\n${html.html}\n`,
					files: []
				})
			}
		},
		{
			name: 'send-danmaku-to-page',
			regex: /<browser-send-danmaku-to-page>(?<content>[\s\S]*?)<\/browser-send-danmaku-to-page>/g,
			/**
			 *
			 * @param {RegExpMatchArray} match - 匹配对象，包含捕获组。
			 */
			handler: async (match) => {
				const content = match.groups.content
				const pageIdMatch = content.match(/<pageId>\s*(.*?)\s*<\/pageId>/s)
				const contentMatch = content.match(/<content>([\s\S]*?)<\/content>/s)
				if (!pageIdMatch || !contentMatch) throw new Error('请求中缺少 <pageId> 或 <content> 标签。')

				const pageId = resolvePageId(pageIdMatch[1].trim())
				const danmakuOptions = {
					content: contentMatch[1].trim()
				}

				const speedMatch = content.match(/<speed>([\s\S]*?)<\/speed>/s)
				if (speedMatch) danmakuOptions.speed = Number(speedMatch[1].trim())

				const colorMatch = content.match(/<color>([\s\S]*?)<\/color>/s)
				if (colorMatch) danmakuOptions.color = colorMatch[1].trim()

				const fontSizeMatch = content.match(/<fontSize>([\s\S]*?)<\/fontSize>/s)
				if (fontSizeMatch) danmakuOptions.fontSize = Number(fontSizeMatch[1].trim())

				const yPosMatch = content.match(/<yPos>([\s\S]*?)<\/yPos>/s)
				if (yPosMatch) danmakuOptions.yPos = Number(yPosMatch[1].trim())

				console.info(`AI请求在页面 ${pageId} 发送弹幕:`, danmakuOptions)
				await sendDanmakuToPage(username, pageId, danmakuOptions)
				AddLongTimeLog({
					name: 'browser-integration',
					role: 'tool',
					content: `已在页面 ${pageId} 发送弹幕: ${util.inspect(danmakuOptions)}`,
					files: []
				})
			}
		},
		{
			name: 'run-js-on-page',
			regex: /<browser-run-js-on-page>(?<content>[\s\S]*?)<\/browser-run-js-on-page>/g,
			/**
			 *
			 * @param {RegExpMatchArray} match - 匹配对象，包含捕获组。
			 */
			handler: async (match) => {
				const content = match.groups.content
				const pageIdMatch = content.match(/<pageId>\s*(.*?)\s*<\/pageId>/s)
				const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/s)
				if (!pageIdMatch || !scriptMatch) throw new Error('请求中缺少 <pageId> 或 <script> 标签。')

				const pageId = resolvePageId(pageIdMatch[1].trim())
				const script = scriptMatch[1]
				console.info(`AI请求在页面上运行JS, pageId: ${pageId}`)
				const jsResult = await runJsOnPage(username, pageId, script, { partpath: `chars/${charname}` })
				AddLongTimeLog({
					name: 'browser-integration',
					role: 'tool',
					content: `在页面 ${pageId} 上运行JS的结果：\n` + util.inspect(jsResult, { depth: 4 }),
					files: []
				})
			}
		},
		{
			name: 'add-autorun-script',
			regex: /<browser-add-autorun-script>(?<content>[\s\S]*?)<\/browser-add-autorun-script>/g,
			/**
			 *
			 * @param {RegExpMatchArray} match - 匹配对象，包含捕获组。
			 */
			handler: async (match) => {
				const content = match.groups.content
				const urlRegexMatch = content.match(/<urlRegex>([\s\S]*?)<\/urlRegex>/)
				const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/)
				if (!urlRegexMatch || !scriptMatch) throw new Error('请求中缺少 <urlRegex> 或 <script> 标签。')

				const scriptData = {
					urlRegex: urlRegexMatch[1].trim(),
					script: scriptMatch[1],
					comment: content.match(/<comment>([\s\S]*?)<\/comment>/)?.[1].trim() || ''
				}
				console.info('AI请求添加自动运行脚本:', scriptData)
				const newScript = addAutoRunScript(username, scriptData)
				AddLongTimeLog({
					name: 'browser-integration',
					role: 'tool',
					content: '已添加自动运行脚本：\n' + util.inspect(newScript, { depth: 4 }),
					files: []
				})
			}
		},
		{
			name: 'update-autorun-script',
			regex: /<browser-update-autorun-script>(?<content>[\s\S]*?)<\/browser-update-autorun-script>/g,
			/**
			 *
			 * @param {RegExpMatchArray} match - 匹配对象，包含捕获组。
			 */
			handler: async (match) => {
				const content = match.groups.content
				const idMatch = content.match(/<id>([\s\S]*?)<\/id>/s)
				if (!idMatch) throw new Error('缺少 <id> 标签。')

				const id = idMatch[1].trim()
				const urlRegex = content.match(/<urlRegex>([\s\S]*?)<\/urlRegex>/s)?.[1]
				const script = content.match(/<script>([\s\S]*?)<\/script>/s)?.[1]
				const comment = content.match(/<comment>([\s\S]*?)<\/comment>/s)?.[1]

				if (urlRegex === undefined && script === undefined && comment === undefined)
					throw new Error('必须提供 <urlRegex>, <script>, 或 <comment> 标签中的至少一个。')

				const scriptUpdate = {}
				if (urlRegex !== undefined) scriptUpdate.urlRegex = urlRegex.trim()
				if (script !== undefined) scriptUpdate.script = script
				if (comment !== undefined) scriptUpdate.comment = comment.trim()

				console.info(`AI请求更新自动运行脚本, id: ${id}:`, scriptUpdate)
				const updatedScript = updateAutoRunScript(username, id, scriptUpdate)
				AddLongTimeLog({
					name: 'browser-integration',
					role: 'tool',
					content: '已更新自动运行脚本：\n' + util.inspect(updatedScript, { depth: 4 }),
					files: []
				})
			}
		},
		{
			name: 'remove-autorun-script',
			regex: /<browser-remove-autorun-script>\s*<id>(.*?)<\/id>\s*<\/browser-remove-autorun-script>/gs,
			/**
			 *
			 * @param {RegExpMatchArray} match - 匹配对象，包含捕获组。
			 */
			handler: async (match) => {
				const id = match[1].trim()
				console.info(`AI请求删除自动运行脚本, id: ${id}`)
				const removeResult = removeAutoRunScript(username, id)
				AddLongTimeLog({
					name: 'browser-integration',
					role: 'tool',
					content: `删除自动运行脚本 (id: ${id}) 结果：\n` + util.inspect(removeResult, { depth: 4 }),
					files: []
				})
			}
		},
		{
			name: 'list-autorun-scripts',
			regex: /<browser-list-autorun-scripts>\s*<\/browser-list-autorun-scripts>/g,
			/**
			 * 处理列出自动运行脚本的命令。
			 */
			handler: async () => {
				console.info('AI请求列出自动运行脚本')
				const scripts = listAutoRunScripts(username)
				AddLongTimeLog({
					name: 'browser-integration',
					role: 'tool',
					content: '自动运行脚本列表：\n' + util.inspect(scripts, { depth: 4 }),
					files: []
				})
			}
		}
	]

	for (const processor of commandProcessors)
		for (const match of result.content.matchAll(processor.regex)) {
			processed = true
			unlockAchievement('use_browser_integration')
			statisticDatas.toolUsage.browserOperations = (statisticDatas.toolUsage.browserOperations || 0) + 1
			commands_called.push(match[0])
			try {
				await processor.handler(match)
			}
			catch (err) {
				handleError(err, processor.name)
			}
		}

	if (commands_called.length)
		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: commands_called.join('\n'),
			files: []
		})

	return processed
}

/**
 * 处理来自浏览器 JavaScript 的回调。
 * @param {object} options - 包含回调数据的对象。
 * @param {any} options.data - 浏览器脚本返回的数据。
 * @param {number} options.pageId - 发生回调的页面ID。
 * @param {string} options.script - 触发回调的原始脚本。
 */
export function BrowserJsCallback({ data, pageId, script }) {
	statisticDatas.toolUsage.browserCallbacks = (statisticDatas.toolUsage.browserCallbacks || 0) + 1
	const logEntry = {
		name: 'system',
		role: 'system',
		content: `\
你的浏览器JS脚本中的callback函数被调用了。
页面ID: ${pageId}
你此前执行的脚本是:
\`\`\`javascript
${script}
\`\`\`
脚本返回的数据是:
\`\`\`json
${util.inspect(data, { depth: null })}
\`\`\`
请根据callback函数的内容进行回复。
`,
		files: [],
		charVisibility: [charname],
	}
	UseNotifyAbleChannel(async channel => {
		try {
			const result = await GetReply({
				...channel,
				chat_log: [...channel.chat_log, logEntry],
				extension: { ...channel.extension, from_browser_js_callback: true }
			})
			if (!result) return
			result.logContextBefore.push(logEntry)
			await channel.AddChatLogEntry({ name: '龙胆', ...result })
			newCharReply(result.content, channel.extension?.platform || 'chat')
		}
		catch (error) {
			console.error('Error processing browser callback:', error)
			await channel.AddChatLogEntry({
				name: 'system',
				role: 'system',
				content: `处理浏览器回调时出错: ${error.stack}`,
				files: [],
			})
		}
	})
}
