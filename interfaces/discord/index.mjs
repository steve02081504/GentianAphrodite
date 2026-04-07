import { registerPlatformAPI } from '../../bot_core/index.mjs'

import { registerEventHandlers } from './event-handlers.mjs'
import { buildPlatformAPI } from './platform-api.mjs'
import { setDiscordClientInstance } from './state.mjs'

/**
 * Discord 接口配置类型定义
 * @typedef {import('./config.mjs').DiscordInterfaceConfig_t} DiscordInterfaceConfig_t
 * Discord 客户端类型定义
 * @typedef {import('npm:discord.js').Client} Client
 */

/**
 * Discord 平台API类型定义
 * @type {import('../../bot_core/index.mjs').PlatformAPI_t | null}
 */
export let discordPlatformAPI = null

/**
 * Discord 机器人接口的主入口函数。
 * 此函数初始化 Discord 平台 API，注册事件处理器，并将平台 API 注册到机器人核心。
 * @param {Client} client - 已初始化的 `discord.js` 客户端实例。
 * @param {DiscordInterfaceConfig_t} interfaceConfig - 此 Discord 接口的特定配置对象。
 * @returns {Promise<import('../../bot_core/index.mjs').PlatformAPI_t>} 返回构建的平台 API 实例。
 */
export async function DiscordBotMain(client, interfaceConfig) {
	setDiscordClientInstance(client)

	discordPlatformAPI = buildPlatformAPI(interfaceConfig)

	await registerEventHandlers(interfaceConfig, discordPlatformAPI)

	await registerPlatformAPI(discordPlatformAPI)

	return discordPlatformAPI
}

/**
 * 获取Discord 接口配置模板
 * @typedef {import('./config.mjs').GetBotConfigTemplate} GetBotConfigTemplate
 */
export { GetBotConfigTemplate } from './config.mjs'
