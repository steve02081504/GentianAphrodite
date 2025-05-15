import { lewd_words, rude_words } from '../../scripts/dict.mjs'
import { match_keys } from '../../scripts/match.mjs'

/**
 * 获取 Telegram API 插件。
 * @param {import('npm:telegraf').Telegraf} bot - Telegraf 实例。
 * @param {import('npm:telegraf/typings/core/types/typegram').Message} triggeringMessage - 触发此操作的原始 Telegram 消息对象。
 * @returns {import('../../../../../../../src/decl/pluginAPI.ts').pluginAPI_t}
 */
export const get_telegram_api_plugin = (bot, triggeringMessage) => ({
	info: {
		'zh-CN': {
			name: 'Telegram 插件',
			description: '使 AI 能够在 Telegram 群组中进行高级操作。',
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
你可以使用以下变量来访问Telegram API:
message: 你正在回复的Telegram消息
chat: 发生回复的Telegram群组
bot: 你的Telegraf Bot实例
你可以用它们来进行高级操作，比如禁言、踢人、ban人、设置身份组、设置权限等。
`
			},
			GetJSCodeContext: async (args, result, detail_level) => {
				return {
					message: triggeringMessage,
					chat: triggeringMessage.chat,
					bot,
				}
			}
		}
	}
})
