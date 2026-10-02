import { loadPart } from '../../../../../src/server/parts_loader.mjs'

import { GentianAphrodite, initCharBase, charname, username } from './charbase.mjs'
import { GetData, SetData, GetConfigDisplayContent } from './config/index.mjs'
import { setConfigEndpoints } from './config/router.mjs'
import { initializeOnIdleHandler, stopIdleTimer } from './event_engine/on-idle.mjs'
import { initializeVoiceSentinel, stopVoiceSentinel } from './event_engine/voice-sentinel.mjs'
import { GetGreeting, GetGroupGreeting } from './greetings/index.mjs'
import { UpdateInfo } from './info/index.mjs'
import { discordStickers } from './interfaces/discord/stickers.mjs'
import { telegramStickers } from './interfaces/telegram/stickers.mjs'
import { GetPrompt } from './prompt/index.mjs'
import { loadMemoriesFromDisk, saveMemories } from './prompt/memory/index.mjs'
import { GetPromptForOther } from './prompt/role_settings/for-other.mjs'
import { handleCharTopLevelError } from './reply_gener/error.mjs'
import { GetReply } from './reply_gener/index.mjs'
import { unlockAchievement } from './scripts/achievements.mjs'
import { checkAndBackupDir, checkAndBackupMemoryFile } from './scripts/backup.mjs'
import { startClipboardListening, stopClipboardListening } from './scripts/clipboard.mjs'
import { GetPluginPrompt, GetPluginServiceSource, OnPluginEvent } from './scripts/plugin-customization.mjs'
import { loadStatisticDatasFromDisk } from './scripts/statistics.mjs'
import { saveVars } from './scripts/vars.mjs'
import { OnGroupEvent } from './trigger/onGroupEvent.mjs'
import { initTriggerIdentity, OnMessage, selfEntityHash } from './trigger/onMessage.mjs'

Object.assign(GentianAphrodite, {
	info: await UpdateInfo(),

	/**
	 * @param {Error} error 错误
	 * @param {object} context OnError 上下文
	 * @returns {Promise<boolean>} true 表示已处理
	 */
	OnError: async (error, context) => handleCharTopLevelError(error, context, selfEntityHash),

	/**
	 * 加载角色时执行的初始化操作。
	 * @param {object} stat - 包含初始化状态的对象。
	 */
	Load: async stat => {
		initCharBase(stat)
		await checkAndBackupMemoryFile('memory/long-term-memory.json')
		await checkAndBackupMemoryFile('memory/short-term-memory.json')
		loadMemoriesFromDisk()
		await checkAndBackupDir('vars')
		loadStatisticDatasFromDisk()
		GentianAphrodite.info = await UpdateInfo()
		initializeOnIdleHandler()
		initializeVoiceSentinel()
		startClipboardListening()
		setConfigEndpoints(stat.router)
		unlockAchievement('installed')
		await initTriggerIdentity(stat.username)
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
		plugins: {
			OnEvent: OnPluginEvent,
			GetServiceSource: GetPluginServiceSource,
			GetPrompt: GetPluginPrompt,
		},
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
			OnMessage,
			OnGroupEvent,
		},
		telegram: {
			stickers: telegramStickers,
		},
		discord: {
			stickers: discordStickers,
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
			/**
			 * 兼容旧脚本的角色回调地址，处理逻辑由宿主插件提供。
			 * @param {object} payload 浏览器回调数据。
			 * @returns {Promise<void>} 回调完成。
			 */
			BrowserJsCallback: async payload => {
				const plugin = await loadPart(username, 'plugins/browser-integration')
				await plugin.interfaces.browserIntegration.BrowserJsCallback({ ...payload, username, char_id: charname })
			},
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
				const plugin = await loadPart(username, 'plugins/timer')
				await plugin.interfaces.timers.TimerCallback(username, uid, {
					...callbackdata,
					char_id: callbackdata.char_id || charname,
					chatLogSnip: callbackdata.chatLogSnip ?? callbackdata.chat_log_snip,
				})
			}
		}
	}
})

/**
 * 默认导出的 GentianAphrodite 对象。
 * @returns {object} - GentianAphrodite 对象。
 */
export default GentianAphrodite
