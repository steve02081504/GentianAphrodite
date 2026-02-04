import { addPartLocaleData } from '../../../../../src/scripts/i18n.mjs'
import { loadJsonFile } from '../../../../../src/scripts/json_loader.mjs'

import { chardir, GentianAphrodite, initCharBase, username } from './charbase.mjs'
import { checkAndBackupMemoryFile } from './scripts/backup.mjs'
import { GetData, SetData, GetConfigDisplayContent } from './config/index.mjs'
import { setConfigEndpoints } from './config/router.mjs'
import { initializeOnIdleHandler, stopIdleTimer } from './event_engine/on_idle.mjs'
import { initializeVoiceSentinel, stopVoiceSentinel } from './event_engine/voice_sentinel.mjs'
import { GetGreeting, GetGroupGreeting } from './greetings/index.mjs'
import { UpdateInfo } from './info/index.mjs'
import { GetPrompt, GetPromptForOther } from './prompt/index.mjs'
import { saveMemories } from './prompt/memory/index.mjs'
import { BrowserJsCallback } from './reply_gener/functions/browserIntegration.mjs'
import { timerCallBack } from './reply_gener/functions/timer.mjs'
import { GetReply } from './reply_gener/index.mjs'
import { unlockAchievement } from './scripts/achievements.mjs'
import { startClipboardListening, stopClipboardListening } from './scripts/clipboard.mjs'
import { saveVars } from './scripts/vars.mjs'

Object.assign(GentianAphrodite, {
	info: await UpdateInfo(),

	/**
	 * 加载角色时执行的初始化操作。
	 * @param {object} stat - 包含初始化状态的对象。
	 */
	Load: async stat => {
		initCharBase(stat)
		await checkAndBackupMemoryFile('memory/long-term-memory.json')
		await checkAndBackupMemoryFile('memory/short-term-memory.json')
		addPartLocaleData(username, 'chars/GentianAphrodite', ['zh-CN', 'en-US'], locale => loadJsonFile(chardir + `/locales/${locale}.json`))
		initializeOnIdleHandler()
		initializeVoiceSentinel()
		startClipboardListening()
		setConfigEndpoints(stat.router)
		unlockAchievement('installed')
	},
	/**
	 * 卸载角色时执行的清理操作。
	 * @param {string} reason - 卸载的原因。
	 */
	Unload: async reason => {
		stopIdleTimer()
		stopVoiceSentinel()
		stopClipboardListening()
		await saveMemories()
		saveVars()
	},

	interfaces: {
		info: {
			UpdateInfo,
		},
		config: {
			GetConfigDisplayContent,
			GetData,
			SetData,
		},
		chat: {
			GetGreeting,
			GetGroupGreeting,
			GetPrompt,
			GetPromptForOther,
			GetReply,
		},
		discord: {
			/**
			 * 当 Discord 客户端准备就绪时执行。
			 * @param {import('npm:discord.js').Client} client - Discord 客户端实例。
			 * @param {object} config - 配置对象。
			 * @returns {Promise<void>}
			 */
			OnceClientReady: (client, config) => import('./interfaces/discord/index.mjs').then(mod => mod.DiscordBotMain(client, config)),
			/**
			 * 获取机器人配置模板。
			 * @returns {Promise<object>} - 机器人配置模板对象。
			 */
			GetBotConfigTemplate: () => import('./interfaces/discord/index.mjs').then(mod => mod.GetBotConfigTemplate()),
		},
		telegram: {
			/**
			 * 设置 Telegram 机器人。
			 * @param {import('npm:telegraf').Telegraf} bot - Telegraf 机器人实例。
			 * @param {object} config - 配置对象。
			 * @returns {Promise<void>}
			 */
			BotSetup: (bot, config) => import('./interfaces/telegram/index.mjs').then(mod => mod.TelegramBotMain(bot, config)),
			/**
			 * 获取机器人配置模板。
			 * @returns {Promise<object>} - 机器人配置模板对象。
			 */
			GetBotConfigTemplate: () => import('./interfaces/telegram/index.mjs').then(mod => mod.GetBotConfigTemplate()),
		},
		shellassist: {
			/**
			 * 执行 shell 辅助操作。
			 * @param {object} args - 参数对象。
			 * @returns {Promise<any>} - shell 辅助操作的结果。
			 */
			Assist: async args => import('./interfaces/shellassist/index.mjs').then(mod => mod.shellAssistMain(args))
		},
		browserIntegration: {
			BrowserJsCallback
		},
		timers: {
			/**
			 * 处理计时器回调。
			 * @param {string} username - 用户名。
			 * @param {string} uid - 用户 ID。
			 * @param {object} callbackdata - 回调数据。
			 * @returns {Promise<void>}
			 */
			TimerCallback: async (username, uid, callbackdata) => {
				const { type } = callbackdata
				switch (type) {
					case 'timer':
						timerCallBack(callbackdata)
						break
					default:
						throw new Error(`Unknown timer type: ${type}`)
				}
			}
		}
	}
})

/**
 * 默认导出的 GentianAphrodite 对象。
 * @returns {object} - GentianAphrodite 对象。
 */
export default GentianAphrodite
