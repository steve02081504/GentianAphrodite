import { registerPlatformAPI } from '../../bot_core/index.mjs'

import { registerEventHandlers } from './event-handlers.mjs'
import { buildPlatformAPI } from './platform-api.mjs'
import { setDiscordClientInstance } from './state.mjs'

/**
 * @typedef {import('./config.mjs').DiscordInterfaceConfig_t} DiscordInterfaceConfig_t
 */
/**
 * @typedef {import('npm:discord.js').Client} Client
 */

/**
 * Discord 机器人接口的主入口函数。
 * 此函数初始化 Discord 平台 API，注册事件处理器，并将平台 API 注册到机器人核心。
 * @param {Client} client - 已初始化的 `discord.js` 客户端实例。
 * @param {DiscordInterfaceConfig_t} interfaceConfig - 此 Discord 接口的特定配置对象。
 * @returns {Promise<import('../../bot_core/index.mjs').PlatformAPI_t>} 返回构建的平台 API 实例。
 */
export async function DiscordBotMain(client, interfaceConfig) {
	setDiscordClientInstance(client)

	const discordPlatformAPI = buildPlatformAPI(interfaceConfig)

	await registerEventHandlers(interfaceConfig, discordPlatformAPI)

	await registerPlatformAPI(discordPlatformAPI)

	return discordPlatformAPI
}

export { GetBotConfigTemplate } from './config.mjs'
