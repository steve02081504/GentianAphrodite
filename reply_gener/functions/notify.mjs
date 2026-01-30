import { sendDanmakuToPage } from '../../../../../../../src/public/parts/shells/browserIntegration/src/api.mjs'
import { notify as systemNotify } from '../../../../../../../src/scripts/notify.mjs'
import { charname, username } from '../../charbase.mjs'
import { config } from '../../config/index.mjs'
import { discordPlatformAPI } from '../../interfaces/discord/index.mjs'
import { telegramPlatformAPI } from '../../interfaces/telegram/index.mjs'

/** 默认弹幕颜色 */
const DEFAULT_DANMAKU_COLOR = 'FF69B4'

/**
 * 从 <notify> 标签的属性字符串中解析 color 和 fontSize。
 * @param {string} [attrs] - 标签属性字符串，如 'color="FF69B4" fontSize="24"'
 * @returns {{ color?: string, fontSize?: number }}
 */
function parseNotifyAttrs(attrs) {
	attrs = String(attrs ?? '').trim()
	const color = attrs.match(/(?:^|\s)color\s*=\s*["']([^"']*)["']/i)?.[1]?.trim?.()
	const fontSize = Number(attrs.match(/(?:^|\s)font[-_]?size\s*=\s*["']([^"']*)["']/i)?.[1]?.trim?.() || 0)
	return { color, fontSize }
}

/**
 * 通过多种渠道发送现实频道通知。先尝试在活跃页面发弹幕，再按配置顺序发送通知。
 * @param {string} message - 要发送的通知内容。
 * @param {string} [purpose] - 触发目的，用于选择对应的通知顺序配置。
 * @param {{ color?: string, fontSize?: number }} [danmakuOpts] - 弹幕样式。
 */
async function sendRealityNotification(message, purpose, danmakuOpts = {}) {
	sendDanmakuToPage(username, undefined, {
		content: message,
		color: danmakuOpts.color || DEFAULT_DANMAKU_COLOR,
		fontSize: danmakuOpts.fontSize || undefined
	}).catch(e => {
		console.warn('[RealityNotify] Danmaku failed:', e)
	})

	const order = config.reality_channel_notification_fallback_order?.[purpose] ?? ['discord', 'telegram', 'system']
	for (const method of order)
		try {
			switch (method) {
				case 'discord':
					if (discordPlatformAPI?.sendDirectMessageToOwner) {
						await discordPlatformAPI.sendDirectMessageToOwner(message)
						return
					}
					break
				case 'telegram':
					if (telegramPlatformAPI?.sendDirectMessageToOwner) {
						await telegramPlatformAPI.sendDirectMessageToOwner(message)
						return
					}
					break
				case 'system':
					systemNotify(charname, message)
					return
			}
		} catch (e) { }


	console.error(`[RealityNotify] All notification methods failed for message: "${message}"`)
}

/**
 * 处理 AI 回复中的 `<notify>` 与 `<system-notify>`，提取并发送通知。
 * - 在内部循环（is_reality_channel）中：仅发送通知，不触发重生成。
 * - 在非内部循环中：与 file-change 一致，向聊天日志 push 单独的功能调用与 tool 回复，并触发生成。
 * @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t}
 */
export async function notifyHandler(result, args) {
	const rawMatch = result.content.match(/<system-notify>(?<content>[\S\s]*?)<\/system-notify>/)
	if (rawMatch) {
		const content = rawMatch?.groups?.content?.trim?.()
		if (content) {
			result.extension.system_notify = content
			systemNotify(charname, content)
		}
	}

	const match = result.content.match(/<notify(\s+[^>]*)?>(?<content>[\S\s]*?)<\/notify>/)
	if (match) {
		const content = match?.groups?.content?.trim?.()
		if (content) {
			result.extension.notify = content
			await sendRealityNotification(content, result.extension?.source_purpose, parseNotifyAttrs(match[1]))
		}
	}

	if (args.extension?.is_reality_channel) return false
	if (!(rawMatch || match)) return false

	const { AddLongTimeLog } = args
	AddLongTimeLog({
		name: '龙胆',
		role: 'char',
		content: [rawMatch?.[0], match?.[0]].filter(Boolean).join('\n') + '\n'
	})

	const toolResponses = []
	if (rawMatch)
		if (rawMatch?.groups?.content?.trim?.()) toolResponses.push('系统通知已发送。')
		else toolResponses.push('系统通知无内容。')
	if (match)
		if (match?.groups?.content?.trim?.()) toolResponses.push('通知已发送。')
		else toolResponses.push('通知无内容。')
	AddLongTimeLog({
		name: 'notify',
		role: 'tool',
		content: toolResponses.join('\n') + '\n',
		files: []
	})

	return true
}
