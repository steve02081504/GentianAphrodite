import { lewd_words, rude_words } from '../../scripts/dict.mjs'
import { match_keys } from '../../scripts/match.mjs'
import { parseDuration } from '../../scripts/tools.mjs'

/**
 *
 * @param {import('npm:discord.js').Message} message
 * @returns {import('../../../../../../../src/decl/pluginAPI.ts').pluginAPI_t}
 */
export const get_discord_silence_plugin = (message) => ({
	info: {
		'zh-CN': {
			name: 'discord禁言插件',
			description: '禁言插件，让AI能够禁言用户',
			author: 'steve02081504',
		}
	},
	interfaces: {
		chat: {
			GetPrompt: async (args, result, detail_level) => {
				if (await match_keys(args, rude_words, 'any', 6) || await match_keys(args, lewd_words, 'other', 3))
					return {
						additional_chat_log: [
							{
								role: 'system',
								name: 'system',
								content: `\
你可以通过回复以下格式来禁言其他人：
\`\`\`ban
username | time | reason
\`\`\`
可以指定多行，时间单位可以是缩写/英文/中文，如：\`10min\`、\`1d3h2m\`、\`1周\`。
由于discord限制，时间范围只能在1分钟到一周之间。
如：
\`\`\`ban
bad_boy | 10min20s | 说脏话
fox | 1d2h | 人身攻击
hitler | 1week | 种族灭绝
\`\`\`
这将将3个不同的人以不同的原因禁言不同的时间。
`,
							}
						]
					}

				return {}
			},
			ReplyHandler: async (result, { AddLongTimeLog }) => {
				const banlist = result.content.match(/```ban\n(?<banlist>(.*\|.*\|.*\n?)*)\n```/)?.groups?.banlist

				if (banlist) {
					AddLongTimeLog({
						name: '龙胆',
						role: 'char',
						content: '\`\`\`ban\n' + banlist + '\n```',
					})
					const ban_results = []
					const banlist_lines = banlist.split('\n').map(line => line.trim()).filter(line => line)
					for (const banlist_line of banlist_lines) {
						const banlist_line_items = banlist_line.split('|')
						const username = banlist_line_items[0].trim()
						const duration = parseDuration(banlist_line_items[1].trim())
						const reason = banlist_line_items[2].trim()
						try {
							const users = await message.guild.members.fetch({ query: username })
							const user = users.find(member => member.user.username == username) || users[0]

							await user.timeout(duration, reason)
							ban_results.push(`${username} 已被成功禁言 ${duration / 1000} 秒 (${reason})`)
						} catch (error) {
							ban_results.push(`${username} 无法被禁言，原因是：${error.message}: ${error.stack}`)
						}
					}

					AddLongTimeLog({
						name: 'system',
						role: 'system',
						content: ban_results.join('\n')
					})
					return true
				}

				return false
			}
		}
	}
})
