import { GetGreeting, GetGroupGreeting } from './greetings/index.mjs'
import { GetPrompt, GetPromptForOther } from './prompt/index.mjs'
import { GetReply } from './reply_gener/index.mjs'
import { getAISourceData, setAISourceData } from './AISource/index.mjs'
import { info } from './info/index.mjs'
import { initCharBase } from './charbase.mjs'
/** @typedef {import('../../../../../src/decl/charAPI.ts').charAPI_t} charAPI_t */

/** @type {charAPI_t} */
export default {
	info,

	Init: async (stat) => { },
	Load: async (stat) => {
		await initCharBase(stat)
	},
	Unload: (reason) => { },
	Uninstall: (reason, from) => { },

	interfaces: {
		config: {
			GetData: async () => {
				return {
					AIsources: getAISourceData()
				}
			},
			SetData: async (data) => {
				await setAISourceData(data.AIsources)
			}
		},
		chat: {
			GetGreeting,
			GetGroupGreeting,
			GetPrompt,
			GetPromptForOther,
			GetReply,
		},
		discord: {
			OnceClientReady: (client, config) => {
				import('./interfaces/discord/index.mjs').then((mod) => mod.default(client, config))
			}
		}
	}
}
