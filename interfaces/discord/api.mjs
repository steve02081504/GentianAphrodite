import { lewd_words, rude_words } from '../../scripts/dict.mjs'
import { match_keys } from '../../scripts/match.mjs'

import { discordClientInstance } from './state.mjs'

/**
 * 获取Discord API插件。
 * 该插件为AI提供了与Discord API交互所需的上下文和提示，使其能够执行高级操作。
 * @param {import('npm:discord.js').Message | undefined} message - 可选的Discord消息对象，用于提供上下文。
 * @returns {import('../../../../../../../src/decl/pluginAPI.ts').pluginAPI_t} - 插件API对象。
 */
export const get_discord_api_plugin = message => ({
	info: {
		'zh-CN': {
			name: 'discord插件',
			description: 'discord插件，让AI能够进行高级操作',
			author: 'steve02081504',
		}
	},
	interfaces: {
		chat: {
			GetJSCodePrompt: async (args, result, detail_level) => {
				if (
					await match_keys(args, rude_words, 'any', 6) ||
					await match_keys(args, lewd_words, 'other', 3) ||
					await match_keys(args, [
						'身份组', '群', '频道', '设置', '服务器', 'ban', '踢了', '禁言',
						'管理', '操作', '权限', '置顶', '分区', '分组', '帖子', '表情', '帖纸', '反应',
						'修改', '封禁', '邀请', /生成{0,3}链接/, '话题', '投票', '动态', '匿名',
						'删了', '删掉', 'discord', 'https://discord.com/'
					], 'any', 3)
				) {
					if (message) return `\
你可以使用以下变量来访问Discord API:
message: 你正在回复的Discord消息
channel: 发生回复的Discord频道
guild: 发生回复的Discord服务器
discord_client: 你的discord.js客户端
你可以用它们来进行高级操作，比如禁言、踢人、ban人、设置身份组、设置权限等。
`
					if (discordClientInstance) return `\
你可以使用以下变量来访问Discord API:
discord_client: 你的discord.js客户端
你可以用它来进行高级操作，但因为不在Discord聊天中，所以没有message、channel、guild等上下文变量。
`
				}
			},
			GetJSCodeContext: async (args, result, detail_level) => {
				if (message)
					return {
						message,
						channel: message.channel,
						guild: message.guild,
						discord_client: message.client,
					}
				if (discordClientInstance)
					return { discord_client: discordClientInstance }
			}
		}
	}
})
