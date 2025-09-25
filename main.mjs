import { addPartLocaleData } from '../../../../../src/scripts/i18n.mjs'
import { loadJsonFile } from '../../../../../src/scripts/json_loader.mjs'

import { chardir, GentianAphrodite, initCharBase } from './charbase.mjs'
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
import { startClipboardListening, stopClipboardListening } from './scripts/clipboard.mjs'
import { saveVars } from './scripts/vars.mjs'

Object.assign(GentianAphrodite, {
	info: await UpdateInfo(),

	Load: async stat => {
		initCharBase(stat)
		addPartLocaleData('GentianAphrodite', ['zh-CN', 'en-US'], locale => loadJsonFile(chardir + `/locales/${locale}.json`))
		initializeOnIdleHandler()
		initializeVoiceSentinel()
		startClipboardListening()
		setConfigEndpoints(stat.router)
	},
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
			OnceClientReady: (client, config) => import('./interfaces/discord/index.mjs').then(mod => mod.DiscordBotMain(client, config)),
			GetBotConfigTemplate: () => import('./interfaces/discord/index.mjs').then(mod => mod.GetBotConfigTemplate()),
		},
		telegram: {
			BotSetup: (bot, config) => import('./interfaces/telegram/index.mjs').then(mod => mod.TelegramBotMain(bot, config)),
			GetBotConfigTemplate: () => import('./interfaces/telegram/index.mjs').then(mod => mod.GetBotConfigTemplate()),
		},
		shellassist: {
			Assist: async args => import('./interfaces/shellassist/index.mjs').then(mod => mod.shellAssistMain(args))
		},
		browserIntegration: {
			BrowserJsCallback
		},
		timers: {
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

export default GentianAphrodite
