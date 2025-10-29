import { processIncomingMessage, processMessageUpdate } from '../../bot_core/index.mjs'

import { telegramMessageToFountChatLogEntry } from './message-converter.mjs'
import { constructLogicalChannelId } from './utils.mjs'

/**
 * @typedef {import('./config.mjs').TelegramInterfaceConfig_t} TelegramInterfaceConfig_t
 */
/**
 * @typedef {import('../../bot_core/index.mjs').PlatformAPI_t} PlatformAPI_t
 */
/** @typedef {import('npm:telegraf').Telegraf} TelegrafInstance */

/**
 * 注册 Telegram bot 的核心事件处理器。
 * 此函数会为接收新消息和编辑消息等事件设置监听器，
 * 并将这些事件传递给机器人核心逻辑进行处理。
 * @param {TelegrafInstance} bot - Telegraf bot 实例。
 * @param {TelegramInterfaceConfig_t} interfaceConfig - 此 Telegram 接口的配置对象。
 * @param {PlatformAPI_t} telegramPlatformAPI - 用于与机器人核心逻辑通信的平台 API。
 */
export function registerEventHandlers(bot, interfaceConfig, telegramPlatformAPI) {
	bot.on('message', async ctx => {
		if ('message' in ctx.update) {
			const { message } = ctx.update
			const fountEntry = await telegramMessageToFountChatLogEntry(ctx, message, interfaceConfig)
			if (fountEntry) {
				const logicalChanId = constructLogicalChannelId(message.chat.id, message.message_thread_id)
				await processIncomingMessage(fountEntry, telegramPlatformAPI, logicalChanId)
			}
		}
	})

	bot.on('edited_message', async ctx => {
		if ('edited_message' in ctx.update) {
			const message = ctx.update.edited_message
			const fountEntry = await telegramMessageToFountChatLogEntry(ctx, message, interfaceConfig)
			if (fountEntry) {
				const logicalChanId = constructLogicalChannelId(message.chat.id, message.message_thread_id)
				await processMessageUpdate(fountEntry, telegramPlatformAPI, logicalChanId)
			}
		}
	})
}
