import { processIncomingMessage, processMessageUpdate } from '../../bot_core/index.mjs'

import { telegramMediaGroupMessagesToFountChatLogEntry, telegramMessageToFountChatLogEntry } from './message-converter.mjs'
import { constructLogicalChannelId } from './utils.mjs'

/**
 * Telegram 接口配置类型定义
 * @typedef {import('./config.mjs').TelegramInterfaceConfig_t} TelegramInterfaceConfig_t
 * Telegram 客户端类型定义
 * @typedef {import('../../bot_core/index.mjs').PlatformAPI_t} PlatformAPI_t
 */
/** @typedef {import('npm:telegraf').Telegraf} TelegrafInstance */
/** @typedef {import('npm:telegraf/typings/core/types/typegram').Message} TelegramMessageType */

/**
 * @typedef {{
 * 	messages: TelegramMessageType[];
 * 	logicalChanId: string | number;
 * 	ctx: import('npm:telegraf').Context;
 * 	timer: ReturnType<typeof setTimeout> | null;
 * }} MediaGroupBufferState
 */

/** @type {Map<string, MediaGroupBufferState>} */
const telegramMediaGroupBuffers = new Map()

/**
 * 注册 Telegram bot 的核心事件处理器。
 * 此函数会为接收新消息和编辑消息等事件设置监听器，
 * 并将这些事件传递给机器人核心逻辑进行处理。
 * @param {TelegrafInstance} bot - Telegraf bot 实例。
 * @param {TelegramInterfaceConfig_t} interfaceConfig - 此 Telegram 接口的配置对象。
 * @param {PlatformAPI_t} telegramPlatformAPI - 用于与机器人核心逻辑通信的平台 API。
 */
export function registerEventHandlers(bot, interfaceConfig, telegramPlatformAPI) {
	/**
	 * 将缓冲中的相册消息合并后交给 `processIncomingMessage`。
	 * @param {string} bufferKey - `logicalChanId:media_group_id` 形式的缓冲键。
	 * @returns {Promise<void>}
	 */
	const flushTelegramMediaGroup = async bufferKey => {
		const state = telegramMediaGroupBuffers.get(bufferKey)
		if (!state) return
		const batch = [...state.messages]
		state.messages.length = 0
		try {
			const fountEntry = await telegramMediaGroupMessagesToFountChatLogEntry(state.ctx, batch, interfaceConfig)
			if (fountEntry)
				await processIncomingMessage(fountEntry, telegramPlatformAPI, state.logicalChanId)
			if (state.messages.length)
				scheduleMediaGroupFlush(state, bufferKey)
			else
				telegramMediaGroupBuffers.delete(bufferKey)
		}
		catch (e) {
			console.error('[TelegramInterface] flushTelegramMediaGroup failed:', e)
			state.messages = [...batch, ...state.messages]
			scheduleMediaGroupFlush(state, bufferKey)
		}
	}

	/**
	 * 重置相册合并的防抖定时器，到期后触发 `flushTelegramMediaGroup`。
	 * @param {MediaGroupBufferState} state - 当前频道下的媒体组缓冲状态。
	 * @param {string} bufferKey - 与 `flushTelegramMediaGroup` 相同的缓冲键。
	 * @returns {void}
	 */
	const scheduleMediaGroupFlush = (state, bufferKey) => {
		if (state.timer)
			clearTimeout(state.timer)
		state.timer = setTimeout(() => {
			state.timer = null
			flushTelegramMediaGroup(bufferKey)
		}, interfaceConfig.MediaGroupFlushMs ?? 550)
	}

	bot.on('message', async ctx => {
		if (ctx.update?.message) {
			const { message } = ctx.update
			const logicalChanId = constructLogicalChannelId(message.chat.id, message.message_thread_id)

			if (message.media_group_id) {
				const bufferKey = `${logicalChanId}:${message.media_group_id}`
				let state = telegramMediaGroupBuffers.get(bufferKey)
				if (!state) {
					state = { messages: [], logicalChanId, ctx, timer: null }
					telegramMediaGroupBuffers.set(bufferKey, state)
				}
				state.ctx = ctx
				if (!state.messages.some(m => m.message_id === message.message_id))
					state.messages.push(message)
				scheduleMediaGroupFlush(state, bufferKey)
				return
			}

			const fountEntry = await telegramMessageToFountChatLogEntry(ctx, message, interfaceConfig)
			if (fountEntry)
				await processIncomingMessage(fountEntry, telegramPlatformAPI, logicalChanId)
		}
	})

	bot.on('edited_message', async ctx => {
		if (ctx.update?.edited_message) {
			const message = ctx.update.edited_message
			const logicalChanId = constructLogicalChannelId(message.chat.id, message.message_thread_id)

			if (message.media_group_id) {
				const bufferKey = `${logicalChanId}:${message.media_group_id}`
				const state = telegramMediaGroupBuffers.get(bufferKey)
				if (state) {
					const idx = state.messages.findIndex(m => m.message_id === message.message_id)
					if (idx >= 0) state.messages[idx] = message
					else state.messages.push(message)
					state.ctx = ctx
					scheduleMediaGroupFlush(state, bufferKey)
					return
				}
			}

			const fountEntry = await telegramMessageToFountChatLogEntry(ctx, message, interfaceConfig)
			if (fountEntry)
				await processMessageUpdate(fountEntry, telegramPlatformAPI, logicalChanId)
		}
	})
}
