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
 * @param {TelegrafInstance} bot
 * @param {TelegramInterfaceConfig_t} interfaceConfig
 * @param {PlatformAPI_t} telegramPlatformAPI
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
