/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

import { parseDuration } from '../../scripts/tools.mjs'
import { GetReply } from '../index.mjs'

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").RepalyHandler_t} */
export async function timer(result, { AddChatLogEntry, Update, AddLongTimeLog }) {
	const timerlist = result.content.match(/```timer\n(?<timerlist>(.*\|.*\n?)*)\n```/)?.groups?.timerlist

	if (timerlist) {
		const timerlist_lines = timerlist.split('\n').map(line => line.trim()).filter(line => line)
		let timerLog = '' // 用于记录定时器信息的字符串
		result.extension.timers ??= []
		for (const timerlist_line of timerlist_lines) {
			const timerlist_line_items = timerlist_line.split('|')
			const timestr = timerlist_line_items[0].trim()
			const time = parseDuration(timestr)
			const reason = timerlist_line_items[1].trim()
			console.log('AI设置的定时器:', timestr, reason)

			timerLog += `时长：${timestr}（${time}ms），原因：${reason}\n` // 添加到定时器信息字符串

			setTimeout(async () => {
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
			}, time)
			result.extension.timers.push({ timestr, time, reason })
		}

		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: '```timer\n' + timerlist + '\n```',
			files: []
		})

		AddLongTimeLog({
			name: 'system',
			role: 'system',
			content: `已设置以下定时器：\n${timerLog}`,
			files: []
		})

		return true
	}
	return false
}
