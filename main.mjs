import { GetGreeting, GetGroupGreeting } from './greetings/index.mjs'
import { GetPrompt, GetPromptForOther } from './prompt/index.mjs'
import { GetReply } from './reply_gener/index.mjs'
import { info } from './info/index.mjs'
import { initCharBase } from './charbase.mjs'
import { GetData, SetData } from './config.mjs'
import { saveMemorys } from './prompt/memory/index.mjs'
/** @typedef {import('../../../../../src/decl/charAPI.ts').charAPI_t} charAPI_t */

/** @type {charAPI_t} */
export default {
	info,

	Init: async (stat) => { },
	Load: async (stat) => {
		await initCharBase(stat)
	},
	Unload: async (reason) => {
		await saveMemorys()
	},
	Uninstall: (reason, from) => { },

	interfaces: {
		config: {
			GetData,
			SetData
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
		shellassist: {
			Assist: async (args) => import('./interfaces/shellassist/index.mjs').then((mod) => mod.shellAssistMain(args))
		}
	}
}
