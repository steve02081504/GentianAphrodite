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
import { defineReplyHandler, defineReplyHandlers } from '../../../../../../../src/public/parts/shells/chat/src/reply/defineReplyHandler.mjs'
import { charname } from '../../charbase.mjs'
import { unlockAchievement } from '../../scripts/achievements.mjs'
import { UseNotifyAbleChannel } from '../../scripts/notify.mjs'
import { statisticDatas, newCharReply } from '../../scripts/statistics.mjs'
import { GetReply } from '../index.mjs'

/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * 追加一条浏览器集成工具日志。
 * @param {object} args 请求上下文
 * @param {string} content 日志内容
 * @param {object[]} [files] 结果附件
 * @returns {void}
 */
function logBrowserTool(args, content, files = []) {
	args.AddLongTimeLog({
		name: 'browser-integration',
		role: 'tool',
		content,
		files
	})
}

/**
 * 处理浏览器集成命令执行期间发生的错误。
 * @param {object} args 请求上下文
 * @param {Error} err 抛出的错误对象
 * @param {string} command 尝试执行的命令的名称
 * @returns {void}
 */
function handleBrowserError(args, err, command) {
	console.error(`Error executing browser integration command "${command}":`, err)
	logBrowserTool(args, `执行 ${command} 时出错：\n${err.stack || err.message || err}`)
}

/**
 * 将页面 ID（可能是 'focused'）解析为数字 ID。
 * @param {string} username 用户名
 * @param {string} pageIdRaw 原始页面 ID 字符串
 * @returns {number} 解析后的数字页面 ID
 */
function resolvePageId(username, pageIdRaw) {
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
 * 记录一次浏览器工具使用。
 * @returns {void}
 */
function recordBrowserUsage() {
	unlockAchievement('use_browser_integration')
	statisticDatas.toolUsage.browserOperations = (statisticDatas.toolUsage.browserOperations || 0) + 1
}

/**
 * 处理 `<browser-get-connected-pages>`。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @returns {Promise<object>} 结果
 */
async function getConnectedPagesHandle(reply, args) {
	const { username } = args
	recordBrowserUsage()
	try {
		const pages = getConnectedPages(username)
		logBrowserTool(args, '已连接的页面列表：\n' + util.inspect(pages, { depth: 4 }))
	} catch (err) { handleBrowserError(args, err, 'get-connected-pages') }
	return { regen: true }
}

/**
 * 处理 `<browser-get-focused-page-info>`。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @returns {Promise<object>} 结果
 */
async function getFocusedPageInfoHandle(reply, args) {
	const { username } = args
	recordBrowserUsage()
	try {
		const page = getFocusedPageInfo(username)
		logBrowserTool(args, '当前焦点页面信息：\n' + util.inspect(page, { depth: 4 }))
	} catch (err) { handleBrowserError(args, err, 'get-focused-page-info') }
	return { regen: true }
}

/**
 * 处理 `<browser-get-browse-history>`。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @returns {Promise<object>} 结果
 */
async function getBrowseHistoryHandle(reply, args) {
	const { username } = args
	recordBrowserUsage()
	try {
		const history = getBrowseHistory(username)
		logBrowserTool(args, '浏览历史：\n' + util.inspect(history, { depth: 4 }))
	} catch (err) { handleBrowserError(args, err, 'get-browse-history') }
	return { regen: true }
}

/**
 * 处理 `<browser-get-page-html>`。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function getPageHtmlHandle(reply, args, call) {
	const { username } = args
	recordBrowserUsage()
	try {
		const pageId = resolvePageId(username, call.inner.trim())
		const html = await getPageHtml(username, pageId)
		logBrowserTool(args, `页面 ${pageId} 的HTML内容已作为文件附件。`, [
			{ name: `page-${pageId}.html`, buffer: Buffer.from(html.html, 'utf-8'), mime_type: 'text/html' }
		])
	} catch (err) { handleBrowserError(args, err, 'get-page-html') }
	return { regen: true }
}

/**
 * 处理 `<browser-get-visible-html>`。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function getVisibleHtmlHandle(reply, args, call) {
	const { username } = args
	recordBrowserUsage()
	try {
		const pageId = resolvePageId(username, call.inner.trim())
		const html = await getVisibleHtml(username, pageId)
		logBrowserTool(args, `页面 ${pageId} 的可见HTML内容：\n${html.html}\n`)
	} catch (err) { handleBrowserError(args, err, 'get-visible-html') }
	return { regen: true }
}

/**
 * 处理 `<browser-send-danmaku-to-page>`。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function sendDanmakuToPageHandle(reply, args, call) {
	const { username } = args
	recordBrowserUsage()
	try {
		const content = call.inner
		const pageIdMatch = content.match(/<pageId>\s*(.*?)\s*<\/pageId>/s)
		const contentMatch = content.match(/<content>([\S\s]*?)<\/content>/s)
		if (!pageIdMatch || !contentMatch) throw new Error('请求中缺少 <pageId> 或 <content> 标签。')

		const pageId = resolvePageId(username, pageIdMatch[1].trim())
		const danmakuOptions = {
			content: contentMatch[1].trim()
		}

		const speedMatch = content.match(/<speed>([\S\s]*?)<\/speed>/s)
		if (speedMatch) danmakuOptions.speed = Number(speedMatch[1].trim())

		const colorMatch = content.match(/<color>([\S\s]*?)<\/color>/s)
		if (colorMatch) danmakuOptions.color = colorMatch[1].trim()

		const fontSizeMatch = content.match(/<fontSize>([\S\s]*?)<\/fontSize>/s)
		if (fontSizeMatch) danmakuOptions.fontSize = Number(fontSizeMatch[1].trim())

		const yPosMatch = content.match(/<yPos>([\S\s]*?)<\/yPos>/s)
		if (yPosMatch) danmakuOptions.yPos = Number(yPosMatch[1].trim())

		console.info(`AI请求在页面 ${pageId} 发送弹幕:`, danmakuOptions)
		await sendDanmakuToPage(username, pageId, danmakuOptions)
		logBrowserTool(args, `已在页面 ${pageId} 发送弹幕: ${util.inspect(danmakuOptions)}`)
	} catch (err) { handleBrowserError(args, err, 'send-danmaku-to-page') }
	return { regen: true }
}

/**
 * 处理 `<browser-run-js-on-page>`。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function runJsOnPageHandle(reply, args, call) {
	const { username } = args
	recordBrowserUsage()
	try {
		const content = call.inner
		const pageIdMatch = content.match(/<pageId>\s*(.*?)\s*<\/pageId>/s)
		const scriptMatch = content.match(/<script>([\S\s]*?)<\/script>/s)
		if (!pageIdMatch || !scriptMatch) throw new Error('请求中缺少 <pageId> 或 <script> 标签。')

		const pageId = resolvePageId(username, pageIdMatch[1].trim())
		const script = scriptMatch[1]
		console.info(`AI请求在页面上运行JS, pageId: ${pageId}`)
		const jsResult = await runJsOnPage(username, pageId, script, { partpath: `chars/${charname}` })
		logBrowserTool(args, `在页面 ${pageId} 上运行JS的结果：\n` + util.inspect(jsResult, { depth: 4 }))
	} catch (err) { handleBrowserError(args, err, 'run-js-on-page') }
	return { regen: true }
}

/**
 * 处理 `<browser-add-autorun-script>`。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function addAutoRunScriptHandle(reply, args, call) {
	const { username } = args
	recordBrowserUsage()
	try {
		const content = call.inner
		const urlRegexMatch = content.match(/<urlRegex>([\S\s]*?)<\/urlRegex>/)
		const scriptMatch = content.match(/<script>([\S\s]*?)<\/script>/)
		if (!urlRegexMatch || !scriptMatch) throw new Error('请求中缺少 <urlRegex> 或 <script> 标签。')

		const scriptData = {
			urlRegex: urlRegexMatch[1].trim(),
			script: scriptMatch[1],
			comment: content.match(/<comment>([\S\s]*?)<\/comment>/)?.[1].trim() || ''
		}
		console.info('AI请求添加自动运行脚本:', scriptData)
		const newScript = addAutoRunScript(username, scriptData)
		logBrowserTool(args, '已添加自动运行脚本：\n' + util.inspect(newScript, { depth: 4 }))
	} catch (err) { handleBrowserError(args, err, 'add-autorun-script') }
	return { regen: true }
}

/**
 * 处理 `<browser-update-autorun-script>`。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function updateAutoRunScriptHandle(reply, args, call) {
	const { username } = args
	recordBrowserUsage()
	try {
		const content = call.inner
		const idMatch = content.match(/<id>([\S\s]*?)<\/id>/s)
		if (!idMatch) throw new Error('缺少 <id> 标签。')

		const id = idMatch[1].trim()
		const urlRegex = content.match(/<urlRegex>([\S\s]*?)<\/urlRegex>/s)?.[1]
		const script = content.match(/<script>([\S\s]*?)<\/script>/s)?.[1]
		const comment = content.match(/<comment>([\S\s]*?)<\/comment>/s)?.[1]

		if (urlRegex === undefined && script === undefined && comment === undefined)
			throw new Error('必须提供 <urlRegex>, <script>, 或 <comment> 标签中的至少一个。')

		const scriptUpdate = {}
		if (urlRegex !== undefined) scriptUpdate.urlRegex = urlRegex.trim()
		if (script !== undefined) scriptUpdate.script = script
		if (comment !== undefined) scriptUpdate.comment = comment.trim()

		console.info(`AI请求更新自动运行脚本, id: ${id}:`, scriptUpdate)
		const updatedScript = updateAutoRunScript(username, id, scriptUpdate)
		logBrowserTool(args, '已更新自动运行脚本：\n' + util.inspect(updatedScript, { depth: 4 }))
	} catch (err) { handleBrowserError(args, err, 'update-autorun-script') }
	return { regen: true }
}

/**
 * 处理 `<browser-remove-autorun-script>`。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function removeAutoRunScriptHandle(reply, args, call) {
	const { username } = args
	recordBrowserUsage()
	try {
		const idMatch = call.inner.match(/<id>([\S\s]*?)<\/id>/s)
		if (!idMatch) throw new Error('缺少 <id> 标签。')
		const id = idMatch[1].trim()
		console.info(`AI请求删除自动运行脚本, id: ${id}`)
		const removeResult = removeAutoRunScript(username, id)
		logBrowserTool(args, `删除自动运行脚本 (id: ${id}) 结果：\n` + util.inspect(removeResult, { depth: 4 }))
	} catch (err) { handleBrowserError(args, err, 'remove-autorun-script') }
	return { regen: true }
}

/**
 * 处理 `<browser-list-autorun-scripts>`。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @returns {Promise<object>} 结果
 */
async function listAutoRunScriptsHandle(reply, args) {
	const { username } = args
	recordBrowserUsage()
	try {
		console.info('AI请求列出自动运行脚本')
		const scripts = listAutoRunScripts(username)
		logBrowserTool(args, '自动运行脚本列表：\n' + util.inspect(scripts, { depth: 4 }))
	} catch (err) { handleBrowserError(args, err, 'list-autorun-scripts') }
	return { regen: true }
}

/**
 * 处理浏览器集成命令。
 * @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t}
 */
export const browserIntegration = defineReplyHandlers([
	defineReplyHandler({ tag: 'browser-get-connected-pages', handle: getConnectedPagesHandle }),
	defineReplyHandler({ tag: 'browser-get-focused-page-info', handle: getFocusedPageInfoHandle }),
	defineReplyHandler({ tag: 'browser-get-browse-history', handle: getBrowseHistoryHandle }),
	defineReplyHandler({ tag: 'browser-get-page-html', handle: getPageHtmlHandle }),
	defineReplyHandler({ tag: 'browser-get-visible-html', handle: getVisibleHtmlHandle }),
	defineReplyHandler({ tag: 'browser-send-danmaku-to-page', handle: sendDanmakuToPageHandle }),
	defineReplyHandler({ tag: 'browser-run-js-on-page', handle: runJsOnPageHandle }),
	defineReplyHandler({ tag: 'browser-add-autorun-script', handle: addAutoRunScriptHandle }),
	defineReplyHandler({ tag: 'browser-update-autorun-script', handle: updateAutoRunScriptHandle }),
	defineReplyHandler({ tag: 'browser-remove-autorun-script', handle: removeAutoRunScriptHandle }),
	defineReplyHandler({ tag: 'browser-list-autorun-scripts', handle: listAutoRunScriptsHandle }),
])

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
		uid: 'system',
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
			newCharReply(result.content, channel.extension?.chat?.bridge?.platform || 'chat')
		}
		catch (error) {
			console.error('Error processing browser callback:', error)
			await channel.AddChatLogEntry({
				name: 'system',
				uid: 'system',
				role: 'system',
				content: `处理浏览器回调时出错: ${error.stack}`,
				files: [],
			})
		}
	})
}
