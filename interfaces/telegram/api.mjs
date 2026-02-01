import { lewd_words, rude_words } from '../../scripts/dict.mjs'
import { match_keys } from '../../scripts/match.mjs'

import { telegrafInstance } from './state.mjs'

/**
 * 获取 Telegram API 插件。
 * @param {import('npm:telegraf/typings/core/types/typegram').Message | undefined} triggeringMessage - 触发此操作的原始 Telegram 消息对象。
 * @returns {import('../../../../../../../src/decl/pluginAPI.ts').pluginAPI_t} - 插件API对象。
 */
export const get_telegram_api_plugin = triggeringMessage => ({
	info: {
		'zh-CN': {
			name: 'Telegram 插件',
			description: '使 AI 能够在 Telegram 群组中进行高级操作。',
			author: 'steve02081504',
		}
	},
	interfaces: {
		chat: {
			/**
			 * 获取用于生成 JS 代码的 Prompt。
			 * @param {object} args - 参数对象。
			 * @param {object} result - 结果对象。
			 * @returns {string | undefined} - JS 代码 Prompt 字符串或 undefined。
			 */
			GetJSCodePrompt: async (args, result) => {
				if (
					await match_keys(args, rude_words, 'any', 6) ||
					await match_keys(args, lewd_words, 'other', 3) ||
					await match_keys(args, [
						'身份组', '群', '频道', '设置', '服务器', 'ban', '踢了', '禁言',
						'管理', '操作', '权限', '置顶', '分区', '分组', '帖子', '表情', '贴纸',
						'修改', '封禁', '邀请', /生成{0,3}链接/, '话题', '投票', '动态', '匿名',
						'删了', '删掉', 'tg', 'telegram', 'https://t.me/'
					], 'any', 3)
				) {
					if (triggeringMessage) return `\
你可以使用以下变量来访问Telegram API:
message: 你正在回复的Telegram消息
chat: 发生回复的Telegram群组
telegram_client: 你的Telegraf Bot实例
你可以用它们来进行高级操作，比如禁言、踢人、ban人、设置身份组、设置权限等。
`
					if (telegrafInstance) return `\
你可以使用以下变量来访问Telegram API:
telegram_client: 你的Telegraf Bot实例
你可以用它来进行高级操作，但因为不是在Telegram聊天中，所以没有message、chat等上下文变量。
`
				}
			},
			/**
			 * 获取 JS 代码执行的上下文。
			 * @param {object} args - 参数对象。
			 * @param {object} result - 结果对象。
			 * @returns {object | undefined} - JS 代码上下文对象或 undefined。
			 */
			GetJSCodeContext: async (args, result) => {
				if (triggeringMessage)
					return {
						message: triggeringMessage,
						chat: triggeringMessage.chat,
						telegram_client: telegrafInstance,
					}
				if (telegrafInstance)
					return { telegram_client: telegrafInstance }
			}
		}
	}
})
