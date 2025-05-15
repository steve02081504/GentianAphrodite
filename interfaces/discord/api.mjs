import { lewd_words, rude_words } from '../../scripts/dict.mjs'
import { match_keys } from '../../scripts/match.mjs'

/**
 *
 * @param {import('npm:discord.js').Message} message
 * @returns {import('../../../../../../../src/decl/pluginAPI.ts').pluginAPI_t}
 */
export const get_discord_api_plugin = (message) => ({
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
						'管理', '操作', '权限', '置顶', '分区', '分组', '帖子', '表情', '帖纸',
						'修改', '封禁', '邀请', /生成{0,3}链接/, '话题', '投票', '动态', '匿名'
					], 'any', 3)
				)
					return `\
你可以使用以下变量来访问Discord API:
message: 你正在回复的Discord消息
channel: 发生回复的Discord频道
guild: 发生回复的Discord服务器
client: 你的discord.js客户端
你可以用它们来进行高级操作，比如禁言、踢人、ban人、设置身份组、设置权限等。
`
			},
			GetJSCodeContext: async (args, result, detail_level) => {
				return {
					message,
					channel: message.channel,
					guild: message.guild,
					client: message.client,
				}
			}
		}
	}
})
