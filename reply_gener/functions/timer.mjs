/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

import { parseDuration } from '../../scripts/tools.mjs'
import { GetReply } from '../index.mjs'

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export async function timer(result, { AddChatLogEntry, Update, AddLongTimeLog }) {
	// Match the <timer>...</timer> block and capture its content
	const timerBlockMatch = result.content.match(/<timer>(?<timercontent>[\S\s]*?)<\/timer>/)
	const timercontent = timerBlockMatch?.groups?.timercontent

	if (timercontent) {
		let timerLog = '' // 用于记录定时器信息的字符串
		result.extension.timers ??= []
		const itemRegex = /<item>\s*<time>(.*?)<\/time>\s*<reason>(.*?)<\/reason>\s*<\/item>/gs // Regex to find each item and capture time/reason

		let match
		const timersToSet = []

		// Find all timer items within the content
		while ((match = itemRegex.exec(timercontent)) !== null) {
			const timestr = match[1].trim()
			const reason = match[2].trim()
			try {
				const time = parseDuration(timestr)
				if (isNaN(time) || time <= 0) throw new Error('无效的时间')
				console.log('AI设置的定时器:', timestr, reason)
				timerLog += `时长：${timestr}（${time}ms），原因：${reason}\n` // 添加到定时器信息字符串
				timersToSet.push({ timestr, time, reason })
				result.extension.timers.push({ timestr, time, reason })
			} catch (e) {
				console.warn('解析定时器时间时出错:', timestr, e)
				timerLog += `跳过错误条目：时间="${timestr}", 原因="${reason}" (解析时出错: ${e.message})\n`
			}
		}

		// Only proceed if valid timers were found
		if (timersToSet.length > 0) {
			// Schedule the timers after parsing all of them
			for (const { timestr, time, reason } of timersToSet)
				setTimeout(async () => {
					try {
						const new_req = await Update()
						new_req.chat_log = [...new_req.chat_log, {
							name: 'system',
							role: 'system',
							content: `\
你设置的定时器已经到期，时长为${timestr}（${time}ms），原因为${reason}
请根据定时器内容进行回复。
`
						}]
						new_req.extension.from_timer = true
						AddChatLogEntry(await GetReply(new_req))
					} catch (error) {
						console.error(`Error processing timer callback for "${reason}":`, error)
						// Optionally notify the user/system about the failure
						AddChatLogEntry({
							name: 'system',
							role: 'system',
							content: `处理定时器 "${reason}" 的回调时发生错误: ${error.message}`,
						})
					}
				}, time)


			AddLongTimeLog({
				name: '龙胆',
				role: 'char',
				content: timerBlockMatch[0],
				files: []
			})

			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: `已设置以下定时器：\n${timerLog}\n届时会触发新回复，现在你可以继续当前对话。`,
				files: []
			})

			return true // Indicate that a timer was processed
		} else {
			// Log that the block was found but contained no valid timers
			AddLongTimeLog({
				name: '龙胆',
				role: 'char',
				content: timerBlockMatch[0], // Log what was sent
				files: []
			})
			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: `收到了定时器请求，但未能解析出有效的定时器条目。\n解析日志:\n${timerLog}`,
				files: []
			})
			return true
		}
	}
	return false // No <timer> block found
}
