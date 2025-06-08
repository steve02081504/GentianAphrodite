import { GetGreeting, GetGroupGreeting } from './greetings/index.mjs'
import { GetPrompt, GetPromptForOther } from './prompt/index.mjs'
import { GetReply } from './reply_gener/index.mjs'
import { UpdateInfo } from './info/index.mjs'
import { initCharBase } from './charbase.mjs'
import { GetData, SetData } from './config.mjs'
import { saveMemories } from './prompt/memory/index.mjs'
import { timerCallBack } from './reply_gener/functions/timer.mjs'
import { saveVars } from './scripts/vars.mjs'
/** @typedef {import('../../../../../src/decl/charAPI.ts').charAPI_t} charAPI_t */

/** @type {charAPI_t} */
export default {
	info: await UpdateInfo(),

	Init: async (stat) => { },
	Load: async (stat) => {
		await initCharBase(stat)
	},
	Unload: async (reason) => {
		await saveMemories()
		await saveVars()
	},
	Uninstall: (reason, from) => { },

	interfaces: {
		info: {
			UpdateInfo,
		},
		config: {
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
			OnceClientReady: (client, config) => import('./interfaces/discord/index.mjs').then((mod) => mod.DiscordBotMain(client, config)),
			GetBotConfigTemplate: () => import('./interfaces/discord/index.mjs').then((mod) => mod.GetBotConfigTemplate()),
		},
		telegram: {
			BotSetup: (bot, config) => import('./interfaces/telegram/index.mjs').then((mod) => mod.TelegramBotMain(bot, config)),
			GetBotConfigTemplate: () => import('./interfaces/telegram/index.mjs').then((mod) => mod.GetBotConfigTemplate()),
		},
		shellassist: {
			Assist: async (args) => import('./interfaces/shellassist/index.mjs').then((mod) => mod.shellAssistMain(args))
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
}
