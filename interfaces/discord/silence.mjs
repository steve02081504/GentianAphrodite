import { rude_words } from '../../scripts/dict.mjs'
import { match_keys } from '../../scripts/match.mjs'

function parseDuration(durationString) {
	let dict = {
		seconds: 1000,
		sec: 1000,
		s: 1000,
		minutes: 60 * 1000,
		min: 60 * 1000,
		m: 60 * 1000,
		hours: 60 * 60 * 1000,
		hour: 60 * 60 * 1000,
		h: 60 * 60 * 1000,
		days: 24 * 60 * 60 * 1000,
		day: 24 * 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000,
		weeks: 7 * 24 * 60 * 60 * 1000,
		week: 7 * 24 * 60 * 60 * 1000,
		wk: 7 * 24 * 60 * 60 * 1000,
		w: 7 * 24 * 60 * 60 * 1000,
		months: 30 * 24 * 60 * 60 * 1000,
		month: 30 * 24 * 60 * 60 * 1000,
		mo: 30 * 24 * 60 * 60 * 1000,
		years: 365 * 24 * 60 * 60 * 1000,
		year: 365 * 24 * 60 * 60 * 1000,
		y: 365 * 24 * 60 * 60 * 1000,
		century: 100 * 365 * 24 * 60 * 60 * 1000,
		cent: 100 * 365 * 24 * 60 * 60 * 1000,
		c: 100 * 365 * 24 * 60 * 60 * 1000,
		秒: 1000,
		分钟: 60 * 1000,
		分: 60 * 1000,
		小时: 60 * 60 * 1000,
		时: 60 * 60 * 1000,
		时辰: 2 * 60 * 60 * 1000,
		天: 24 * 60 * 60 * 1000,
		日: 24 * 60 * 60 * 1000,
		星期: 7 * 24 * 60 * 60 * 1000,
		周: 7 * 24 * 60 * 60 * 1000,
		月: 30 * 24 * 60 * 60 * 1000,
		年: 365 * 24 * 60 * 60 * 1000,
		世纪: 100 * 365 * 24 * 60 * 60 * 1000,
	}

	let duration = 0
	for (let unit in dict) {
		let match = durationString.match(new RegExp(`(?<value>\\d+)${unit}`))
		if (match?.groups?.value) {
			duration += parseInt(match.groups.value) * dict[unit]
			durationString = durationString.replace(match[0], '')
		}
	}
	return duration
}

export let get_discord_silence_plugin = (message) => ({
	info: {
		'zh-CN': {
			name: 'discord禁言插件',
			description: '禁言插件，让AI能够禁言用户',
			author: 'steve02081504',
		}
	},
	interfacies: {
		chat: {
			GetPrompt: async (args, result, detail_level) => {
				if (await match_keys(args, rude_words, 'any', 6))
					return {
						additional_chat_log: [
							{
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
			RepalyHandler: async (result, { addLongTimeLog }) => {
				let banlist = result.content.match(/```ban\n(?<banlist>(.*\|.*\|.*\n?)*)\n```/)?.groups?.banlist

				if (banlist) {
					addLongTimeLog({
						name: '龙胆',
						role: 'char',
						content: '\`\`\`ban\n' + banlist + '\n```',
					})
					let ban_results = []
					let banlist_lines = banlist.split('\n').map(line => line.trim()).filter(line => line)
					for (let banlist_line of banlist_lines) {
						let banlist_line_items = banlist_line.split('|')
						let username = banlist_line_items[0].trim()
						let duration = parseDuration(banlist_line_items[1].trim())
						let reason = banlist_line_items[2].trim()
						try {
							let users = await message.guild.members.fetch({ query: username })
							let user = users.find(member => member.user.username == username) || users[0]

							await user.timeout(duration, reason)
							ban_results.push(`${username} 已被成功禁言 ${duration} 秒 (${reason})`)
						} catch (error) {
							ban_results.push(`${username} 无法被禁言，原因是：${error.message}: ${error.stack}`)
						}
					}

					addLongTimeLog({
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
