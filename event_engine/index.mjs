import { localhostLocales } from '../../../../../../src/scripts/i18n.mjs'
import { notify } from '../../../../../../src/scripts/notify.mjs'
import { charname, GentianAphrodite, username } from '../charbase.mjs'

const realityWorld = {
	info: {
		'zh-CN': {
			name: '真实世界',
			description: '用于给角色关于真实世界风格的输出指引',
		},
		'en-US': {
			name: 'Reality World',
			description: 'Guide for reality style output for characters',
		},
	},
	interfaces: {
		chat: {
			GetPrompt: args => {
				return {
					text: [
						{
							content: `\
你输出的文字不会被你主人看见，但你可以使用<notify>通知你主人。
但你不一定非要通知他，如果他正在做其他的事情，弹出通知可能会败坏他的兴致。
`,
							important: 0
						}
					]
				}
			}
		}
	}
}

const notify_plugin = {
	info: {
		'zh-CN': {
			name: '通知插件',
			description: '通知插件，让AI能够通知用户',
			author: 'steve02081504',
		},
		'en-US': {
			name: 'notify plugin',
			description: 'notify plugin, let AI notify users',
			author: 'steve02081504',
		},
	},
	interfaces: {
		chat: {
			GetPrompt: async (args, result, detail_level) => {
				return {
					additional_chat_log: [
						{
							role: 'system',
							name: 'system',
							content: `\
你可以通过回复以下格式来通知${args.UserCharname}：
<notify>
通知内容
</notify>
像这样：
龙胆: 我注意到主人的领带没系好，得通知主人一下才行。
<notify>主人！领带没系好哦！</notify>
`,
						}
					]
				}
			},
			ReplyHandler: async result => {
				const match = result.content.match(/<notify>(?<content>[\S\s]*?)<\/notify>/)
				const content = match?.groups?.content?.trim?.() // Extract and trim the content

				if (content) notify(charname, result.extension.notify = content)

				// Return false as this handler only modifies the result, doesn't fully handle the reply
				return false
			}
		}
	}
}

export const RealityChannel = {}

/**
 * 初始化真实世界频道。
 */
export function initRealityChannel() {
	if (RealityChannel.chat_name) return
	Object.assign(RealityChannel, {
		supported_functions: {
			markdown: false,
			mathjax: false,
			html: false,
			unsafe_html: false,
			files: false,
			add_message: true,
		},
		char: GentianAphrodite,
		world: realityWorld,
		chat_name: 'reality',
		char_id: charname,
		username,
		Charname: '龙胆',
		UserCharname: username,
		locales: localhostLocales,
		time: new Date(),
		chat_log: [
			{
				name: 'system',
				role: 'system',
				content: `\
描述下你对所处环境的理解，并发送一个\`测试通知\`。
`
			},
			{
				name: '龙胆',
				role: 'char',
				content: `\
唔姆！龙胆明白，这些话语是龙胆自己的悄悄话，主人大人是看不到的呢！
不过呀，龙胆可以通过魔法通知，偷偷地给主人大人发送专属的小消息哦！💖
<notify>测试通知</notify>
看！小通知已经成功飞到主人大人那里啦！✨
`
			},
			{
				name: 'system',
				role: 'system',
				content: `\
已确认通知，进入实际环境。
祝你服侍愉快。
`
			}
		],
		AddChatLogEntry: entry => {
			console.dir(entry, { depth: null })
			RealityChannel.chat_log.push(entry)
		},
		other_chars: {},
		plugins: {
			notify_plugin,
		},
		Update: () => {
			RealityChannel.time = new Date()
			return RealityChannel
		},
		chat_scoped_char_memory: {},
		extension: {},
	})
}
