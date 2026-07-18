import { localhostLocales } from '../../../../../../src/scripts/i18n/bare.mjs'
import { charname, GentianAphrodite, username } from '../charbase.mjs'

/**
 * Fount 世界观对象，定义了 AI 角色在“真实世界”中的行为准则和能力。
 * @type {import('../../../../../../src/decl/WorldAPI.ts').WorldAPI_t}
 */
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
			/**
			 * 获取用于“真实世界”模式的 AI 提示。
			 * @param {object} args - 提示参数。
			 * @returns {object} 包含提示文本的对象。
			 */
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

/**
 * 表示一个特殊的“真实世界”频道对象，用于 AI 在不直接与用户交互的情况下进行内部思考和操作。
 * @type {object}
 */
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
		/**
		 * 向“真实世界”频道的聊天日志中添加一个条目。
		 * @param {object} entry - 要添加的聊天日志条目。
		 */
		AddChatLogEntry: entry => {
			console.dir(entry, { depth: null })
			RealityChannel.chat_log.push(entry)
		},
		other_chars: {},
		plugins: {},
		/**
		 * 更新“真实世界”频道对象的时间戳并返回自身。
		 * @returns {object} 更新后的 RealityChannel 对象。
		 */
		Update: () => {
			RealityChannel.time = new Date()
			return RealityChannel
		},
		chat_scoped_char_memory: {},
		extension: {
			is_reality_channel: true
		},
	})
}
