import fs from 'fs'
import { GetGreetings, GetGroupGreetings } from './greetings/index.mjs'
import { GetAISource, SetAISource } from './AISource/index.mjs'
import { FormatStr } from './scripts/tools.mjs'
import { exec } from '../../../../../src/server/exec.mjs'
/** @typedef {import('../../../../../src/decl/charAPI.ts').charAPI_t} charAPI_t */

export let chardir = import.meta.dirname
export let charurl = '/chars/GentianAphrodite'
export let charvar = await exec('git describe --tags', { cwd: chardir }).then((result) => result.stdout)

let PromptMod
let ReplyMod

/** @type {charAPI_t} */
export default {
	info: {
		'zh-CN': {
			name: '龙胆',
			avatar: `${charurl}/imgs/static.png`,
			description: '一个要素爆表的合法萝莉老婆！',
			description_markdown: FormatStr(fs.readFileSync(chardir + '/description/zh-CN.md', 'utf8'), {charvar}),
			version: charvar,
			author: 'steve02081504',
			homepage: '',
			tags: [
				'纯爱',
				'恋爱',
				'恋人',
				'洗脑',
				'母乳',
				'乳头插入',
				'丸吞',
				'萝莉',
				'合法萝莉',
				'母性',
				'重女',
				'孤立型病娇',
				'gaslighting',
				'master-love',
				'贵族',
				'类人',
				'纯人物',
				'男性向',
				'女性角色',
			],
		}
	},

	Init: async (stat) => {
		await exec('npm install --save-optional mime-types opencc-js')
	},
	Load: async (stat) => {
		PromptMod = await import('./prompt/index.mjs')
		ReplyMod = await import('./reply_gener/index.mjs')
	},
	Unload: (reason) => { },
	Uninstall: (reason, from) => { },

	SetAISource,
	GetAISource,
	AISourceTypes: [
		{
			name:'sfw',
			type:'text-chat',
		},
		{
			name:'nsfw',
			type:'text-chat',
		},
		{
			name:'expert',
			type:'text-chat',
		},
		{
			name:'logic',
			type:'text-chat',
		}
	],

	interfacies: {
		chat: {
			GetGreetings,
			GetGroupGreetings,
			GetPrompt: async (args, prompt_struct, detail_level) => {
				return await PromptMod.GetPrompt(args, prompt_struct, detail_level)
			},
			GetReply: async (args) => {
				return await ReplyMod.GetReply(args)
			},
		},
		discord: {
			OnceClientReady: (client, config) => {
				import('./interfaces/discord/index.mjs').then((mod) => mod.default(client, config))
			}
		}
	}
}
