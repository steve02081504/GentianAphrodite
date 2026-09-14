import { sendDanmakuToPage } from '../../../../../../../src/public/parts/shells/browserIntegration/src/api.mjs'
import { getChatClient } from '../../../../../../../src/public/parts/shells/chat/src/api/client/index.mjs'
import { resolveOperatorEntityHash } from '../../../../../../../src/public/parts/shells/chat/src/chat/lib/replica.mjs'
import { ensureLocalAgentEntityHash } from '../../../../../../../src/public/parts/shells/chat/src/entity/member.mjs'
import { defineReplyHandler, defineReplyHandlers } from '../../../../../../../src/public/parts/shells/chat/src/reply/defineReplyHandler.mjs'
import { notify as systemNotify } from '../../../../../../../src/scripts/notify.mjs'
import { charname, username } from '../../charbase.mjs'
import { config } from '../../config/index.mjs'

/** 默认弹幕颜色 */
const DEFAULT_DANMAKU_COLOR = '#FF69B4'

/**
 * 经 ChatClient 向 operator 发 DM。
 * @param {string} message 正文
 * @returns {Promise<boolean>} 是否成功
 */
async function sendDirectMessageToOwner(message) {
	const operatorHash = (await resolveOperatorEntityHash(username))?.toLowerCase()
	if (!operatorHash) return false
	const selfHash = await ensureLocalAgentEntityHash(username, charname)
	const client = await getChatClient(username, selfHash)
	const dm = await client.openDm(operatorHash)
	const channel = await dm.defaultChannel()
	await channel.send({ content: message })
	return true
}

/**
 * 通过多种渠道发送现实频道通知。先尝试在活跃页面发弹幕，再按配置顺序发送通知。
 * @param {string} message - 要发送的通知内容。
 * @param {string} [purpose] - 触发目的，用于选择对应的通知顺序配置。
 * @param {{ color?: string, fontSize?: number }} [danmakuOpts] - 弹幕样式。
 * @returns {Promise<void>} - 无返回值。
 */
async function sendRealityNotification(message, purpose, danmakuOpts = {}) {
	sendDanmakuToPage(username, undefined, {
		content: message,
		color: danmakuOpts.color || DEFAULT_DANMAKU_COLOR,
		fontSize: danmakuOpts.fontSize || undefined
	}).catch(e => {
		console.warn('[RealityNotify] Danmaku failed:', e)
	})

	const order = config.reality_channel_notification_fallback_order?.[purpose] ?? ['telegram', 'discord', 'system']
	for (const method of order)
		try {
			switch (method) {
				case 'telegram':
				case 'discord':
					if (await sendDirectMessageToOwner(message)) return
					break
				case 'system':
					systemNotify(charname, message)
					return
			}
		} catch (e) { }


	console.error(`[RealityNotify] All notification methods failed for message: "${message}"`)
}

/**
 * 处理 `<system-notify>`：发送系统通知。
 * - 在内部循环（is_reality_channel）中：仅发送通知，不触发重生成。
 * - 在非内部循环中：向聊天日志 push tool 回复，并触发生成。
 * @param {object} result 回复对象
 * @param {object} args 请求上下文
 * @param {Function} args.AddLongTimeLog 追加工具结果日志
 * @param {object} args.extension 请求扩展上下文
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function systemNotifyHandle(result, args, call) {
	const AddLongTimeLog = args.AddLongTimeLog
	const extension = args.extension
	const notifyContent = call.inner.trim()
	result.extension ??= {}
	if (notifyContent) {
		result.extension.system_notify = notifyContent
		systemNotify(charname, notifyContent)
	}
	if (extension?.is_reality_channel) return {}

	AddLongTimeLog({
		name: 'notify',
		role: 'tool',
		content: (notifyContent ? '系统通知已发送。' : '系统通知无内容。') + '\n',
		files: []
	})
	return { regen: true }
}

/**
 * 处理 `<notify>`：按配置渠道发送现实频道通知。
 * - 在内部循环（is_reality_channel）中：仅发送通知，不触发重生成。
 * - 在非内部循环中：向聊天日志 push tool 回复，并触发生成。
 * @param {object} result 回复对象
 * @param {object} args 请求上下文
 * @param {Function} args.AddLongTimeLog 追加工具结果日志
 * @param {object} args.extension 请求扩展上下文
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function notifyHandle(result, args, call) {
	const AddLongTimeLog = args.AddLongTimeLog
	const extension = args.extension
	const notifyContent = call.inner.trim()
	result.extension ??= {}
	if (notifyContent) {
		result.extension.notify = notifyContent
		await sendRealityNotification(notifyContent, result.extension?.source_purpose, {
			color: call.params.color || undefined,
			fontSize: call.params.fontSize ?? call.params['font-size'] ?? call.params.font_size,
		})
	}
	if (extension?.is_reality_channel) return {}

	AddLongTimeLog({
		name: 'notify',
		role: 'tool',
		content: (notifyContent ? '通知已发送。' : '通知无内容。') + '\n',
		files: []
	})
	return { regen: true }
}

/**
 * 处理 AI 回复中的 `<notify>` 与 `<system-notify>`，提取并发送通知。
 * @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t}
 */
export const notifyHandler = defineReplyHandlers([
	defineReplyHandler({
		tag: 'system-notify',
		handle: systemNotifyHandle,
	}),
	defineReplyHandler({
		tag: 'notify',
		params: { color: 'string', fontSize: 'number', 'font-size': 'number', font_size: 'number' },
		handle: notifyHandle,
	}),
])
