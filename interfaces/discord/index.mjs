import { registerPlatformAPI } from '../../bot_core/index.mjs'
import { setDiscordClientInstance } from './state.mjs'
import { buildPlatformAPI } from './platform-api.mjs'
import { registerEventHandlers } from './event-handlers.mjs'

/**
 * @typedef {import('./config.mjs').DiscordInterfaceConfig_t} DiscordInterfaceConfig_t
 */
/**
 * @typedef {import('npm:discord.js').Client} Client
 */

/**
 * Discord Bot 的主设置和事件处理函数。
 * @param {Client} client - 已初始化的 Discord.js 客户端实例。
 * @param {DiscordInterfaceConfig_t} interfaceConfig - 传递给此 Discord 接口的特定配置对象。
 */
export async function DiscordBotMain(client, interfaceConfig) {
	setDiscordClientInstance(client)

	const discordPlatformAPI = buildPlatformAPI(interfaceConfig)

	await registerEventHandlers(interfaceConfig, discordPlatformAPI)

	await registerPlatformAPI(discordPlatformAPI)

	return discordPlatformAPI
}

export { GetBotConfigTemplate } from './config.mjs'
