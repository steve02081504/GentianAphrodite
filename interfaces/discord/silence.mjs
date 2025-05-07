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
<ban>
	<item>
		<username>用户名</username>
		<time>禁言时长</time>
		<reason>禁言原因</reason>
	</item>
	<!-- 可以包含多个 <item> -->
</ban>
时间单位可以是缩写/英文/中文，如：\`10min\`、\`1d3h2m\`、\`1周\`。
由于discord限制，时间范围只能在1分钟(1min)到一周(1week)之间。
如：
<ban>
	<item>
		<username>bad_boy</username>
		<time>10min20s</time>
		<reason>说脏话</reason>
	</item>
	<item>
		<username>fox</username>
		<time>1d2h</time>
		<reason>人身攻击</reason>
	</item>
	<item>
		<username>hitler</username>
		<time>1week</time>
		<reason>种族灭绝</reason>
	</item>
</ban>
这将将3个不同的人以不同的原因禁言不同的时间。
`,
							}
						]
					}

				return {} // Return empty object if conditions not met
			},
			ReplyHandler: async (result, { AddLongTimeLog }) => {
				const banBlockMatch = result.content.match(/<ban>(?<bancontent>[\S\s]*?)<\/ban>/)
				const bancontent = banBlockMatch?.groups?.bancontent

				if (bancontent) {
					AddLongTimeLog({
						name: '龙胆',
						role: 'char',
						content: banBlockMatch[0],
					})

					const ban_results = []
					const itemRegex = /<item>\s*<username>(.*?)<\/username>\s*<time>(.*?)<\/time>\s*<reason>(.*?)<\/reason>\s*<\/item>/gs

					let match
					while ((match = itemRegex.exec(bancontent)) !== null) {
						const username = match[1].trim()
						const timeStr = match[2].trim()
						const reason = match[3].trim()
						let duration

						try {
							duration = parseDuration(timeStr)
							// Fetch user - using async/await correctly here
							const users = await message.guild.members.fetch({ query: username, limit: 5 }) // Limit results for safety/performance
							// More robust user finding: prefer exact match, then display name, then first result
							const user = users.find(member => member.user.username === username) ||
								users.find(member => member.displayName === username) ||
								users.first()

							if (!user)
								throw new Error(`未找到用户 "${username}"。`)


							await user.timeout(duration, reason)
							ban_results.push(`${user.user.tag} (${user.displayName}) 已被成功禁言 ${duration / 1000} 秒 (${reason})`)
						} catch (error) {
							// Log more specific errors
							const errorContext = `用户: "${username}", 时长: "${timeStr}", 原因: "${reason}"`
							console.error(`禁言失败 (${errorContext}):`, error)
							ban_results.push(`禁言失败 (${errorContext}) - 原因: ${error.stack}`) // Provide clearer error message
						}
					}

					// Only log if there were items processed
					if (ban_results.length > 0)
						AddLongTimeLog({
							name: 'system',
							role: 'system',
							content: '禁言处理结果:\n' + ban_results.join('\n')
						})
					else
						AddLongTimeLog({
							name: 'system',
							role: 'system',
							content: '收到了禁言请求，但未能解析出有效的禁言条目。'
						})


					return true // Indicate that the <ban> block was handled
				}

				return false // No <ban> block found
			}
		}
	}
})
