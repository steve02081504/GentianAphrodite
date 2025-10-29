import { registerPlatformAPI } from '../../bot_core/index.mjs'
import { charname as BotFountCharname } from '../../charbase.mjs'
import { tryFewTimes } from '../../scripts/tryFewTimes.mjs'

import { registerEventHandlers } from './event-handlers.mjs'
import { buildPlatformAPI } from './platform-api.mjs'
import { setTelegrafInstance, setTelegramBotInfo, telegramBotInfo, telegramUserIdToDisplayName, telegramDisplayNameToId } from './state.mjs'

export { GetBotConfigTemplate } from './config.mjs'

/**
 * @typedef {import('./config.mjs').TelegramInterfaceConfig_t} TelegramInterfaceConfig_t
 */
/** @typedef {import('npm:telegraf').Telegraf} TelegrafInstance */

/**
 * Telegram 机器人接口的主入口函数。
 * 此函数负责初始化 Telegraf 实例，获取机器人自身信息，构建并注册平台 API，
 * 以及设置事件处理器来监听 Telegram 的消息事件。
 * @param {TelegrafInstance} bot - 已初始化的 Telegraf 实例。
 * @param {TelegramInterfaceConfig_t} interfaceConfig - 此 Telegram 接口的特定配置对象。
 * @returns {Promise<import('../../bot_core/index.mjs').PlatformAPI_t>} - 返回构建的平台 API 实例。
 */
export async function TelegramBotMain(bot, interfaceConfig) {
	setTelegrafInstance(bot)
	try {
		const botInfo = await tryFewTimes(() => bot.telegram.getMe())
		setTelegramBotInfo(botInfo)
	}
	catch (error) {
		console.error('[TelegramInterface] Could not get bot info (getMe):', error)
		throw new Error('Bot initialization failed: Could not connect to Telegram or get bot info.')
	}

	if (telegramBotInfo) {
		const botUserId = telegramBotInfo.id
		let botDisplayName = telegramBotInfo.first_name || telegramBotInfo.username || BotFountCharname
		if (telegramBotInfo.username && !botDisplayName.includes(`@${telegramBotInfo.username}`))
			botDisplayName += ` (@${telegramBotInfo.username})`

		telegramUserIdToDisplayName[botUserId] = `${botDisplayName} (咱自己)`
		telegramDisplayNameToId[botDisplayName.split(' (')[0]] = botUserId
		if (BotFountCharname) telegramDisplayNameToId[BotFountCharname] = botUserId
	}

	const telegramPlatformAPI = buildPlatformAPI(interfaceConfig)

	registerEventHandlers(bot, interfaceConfig, telegramPlatformAPI)

	await registerPlatformAPI(telegramPlatformAPI)
	return telegramPlatformAPI
}
