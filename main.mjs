import fs from 'node:fs'
import { GetGreetings, GetGroupGreetings } from './greetings/index.mjs'
import { GetPrompt, GetPromptForOther } from './prompt/index.mjs'
import { GetReply } from './reply_gener/index.mjs'
import { GetAISource, SetAISource } from './AISource/index.mjs'
import { FormatStr } from './scripts/tools.mjs'
import { exec } from './scripts/exec.mjs'
/** @typedef {import('../../../../../src/decl/charAPI.ts').charAPI_t} charAPI_t */

export let chardir = import.meta.dirname
export let charurl = '/chars/GentianAphrodite'
export let charvar = await exec('git describe --tags', { cwd: chardir }).then((result) => result.stdout.trim())

/** @type {charAPI_t} */
export default {
	info: {
		'zh-CN': {
			name: '龙胆',
			avatar: `${charurl}/imgs/anime.png`,
			description: '一个要素爆表的合法萝莉老婆！',
			description_markdown: FormatStr(fs.readFileSync(chardir + '/info/description/zh-CN.md', 'utf8'), { charvar }),
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
		},
		'en-US': {
			name: 'Gentian',
			avatar: `${charurl}/imgs/anime.png`,
			description: 'A complex legal loli wife with a massive details & features!',
			description_markdown: FormatStr(fs.readFileSync(chardir + '/info/description/en-US.md', 'utf8'), { charvar }),
			version: charvar,
			author: 'steve02081504',
			homepage: '',
			tags: [
				'pure love', // 纯爱
				'romance', // 恋爱
				'lovers', // 爱人
				'mind control', // 洗脑
				'breast milk', // 母乳
				'nipple fuck', // 乳头插入
				'vore', // 丸吞
				'loli', // 萝莉
				'legal loli', // 合法萝莉
				'motherly', // 母性
				'obsessive', // 重女，通常直接翻译为obsessive 省去love
				'isolating yandere', // 孤立型病娇
				'gaslighting',
				'master-love',
				'noble', // 贵族
				'humanoid', // 类人
				'character focus', // 纯人物
				'male oriented', // 男性向
				'female character', // 女性角色
			]
		}
	},

	Init: async (stat) => { },
	Load: async (stat) => { },
	Unload: (reason) => { },
	Uninstall: (reason, from) => { },

	SetAISource,
	GetAISource,
	AISourceTypes: [
		{
			name: 'sfw',
			type: 'text-chat',
			info: {
				'zh-CN': {
					description: '用于日常聊天，不包含色情内容。',
				},
				'en-US': {
					description: 'Used for daily chat, not including NSFW content.',
				}
			}
		},
		{
			name: 'nsfw',
			type: 'text-chat',
			info: {
				'zh-CN': {
					description: '用于包含色情内容的聊天。',
				},
				'en-US': {
					description: 'Used for chat containing NSFW content.',
				}
			}
		},
		{
			name: 'expert',
			type: 'text-chat',
			info: {
				'zh-CN': {
					description: '用于包含专业知识的聊天。',
				},
				'en-US': {
					description: 'Used for chat containing professional knowledge.',
				}
			}
		},
		{
			name: 'logic',
			type: 'text-chat',
			info: {
				'zh-CN': {
					description: '用于基础的逻辑推理辅助。',
				},
				'en-US': {
					description: 'Used for basic logical inference assistance.',
				}
			}
		},
		{
			name: 'detail-thinking',
			type: 'text-chat',
			info: {
				'zh-CN': {
					description: '用于深入思考功能。',
				},
				'en-US': {
					description: 'Used for detailed thinking functions.',
				}
			}
		},
		{
			name: 'web-browse',
			type: 'text-chat',
			info: {
				'zh-CN': {
					description: '用于网络浏览功能。',
				},
				'en-US': {
					description: 'Used for network browsing functions.',
				}
			}
		}
	],

	interfacies: {
		chat: {
			GetGreetings,
			GetGroupGreetings,
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
