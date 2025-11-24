/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

import { getTimers, removeTimer, setTimer } from '../../../../../../../src/server/timers.mjs'
import { charname } from '../../charbase.mjs'
import { flatChatLog } from '../../scripts/match.mjs'
import { UseNofityAbleChannel } from '../../scripts/notify.mjs'
import { newCharReplay, statisticDatas } from '../../scripts/statistics.mjs'
import { parseDuration } from '../../scripts/tools.mjs'
import { GetReply } from '../index.mjs'

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export async function timer(result, args) {
	const { AddLongTimeLog } = args
	let processed = false

	const tool_calling_log = {
		name: '龙胆',
		role: 'char',
		content: '',
		files: []
	}
	let log_content_added = false

	const timers = getTimers(args.username, 'chars', args.char_id)

	const setTimerMatches = [...result.content.matchAll(/<set-timer>(?<content>[\S\s]*?)<\/set-timer>/gis)]
	for (const setTimerMatch of setTimerMatches)
		if (setTimerMatch?.groups?.content) {
			statisticDatas.toolUsage.timersSet++
			processed = true
			const timerContent = setTimerMatch.groups.content
			const fullMatch = setTimerMatch[0]

			tool_calling_log.content += fullMatch + '\n'
			if (!log_content_added) AddLongTimeLog(tool_calling_log)
			log_content_added = true

			let systemLogContent = ''
			const itemRegex = /<item>([\S\s]*?)<\/item>/gis
			let itemMatch
			const timersToSet = []

			while ((itemMatch = itemRegex.exec(timerContent)) !== null) {
				const itemContent = itemMatch[1]
				const timeMatch = itemContent.match(/<time>(.*?)<\/time>/is)
				const triggerMatch = itemContent.match(/<trigger>(.*?)<\/trigger>/is)
				const reasonMatch = itemContent.match(/<reason>(.*?)<\/reason>/is)
				const repeatMatch = itemContent.match(/<repeat>(.*?)<\/repeat>/is)

				const timestr = timeMatch?.[1]?.trim()
				const triggerstr = triggerMatch?.[1]?.trim()
				const reason = reasonMatch?.[1]?.trim()
				const repeatstr = repeatMatch?.[1]?.trim().toLowerCase()
				const repeat = repeatstr === 'true'

				if (!reason) {
					systemLogContent += `跳过无效条目：缺少 <reason> 标签。\n内容：\n${itemContent}\n`
					console.warn('解析定时器时出错：缺少 <reason>', itemContent)
					continue
				}
				if (!timestr && !triggerstr) {
					systemLogContent += `跳过无效条目“${reason}”：必须提供 <time> 或 <trigger> 标签。\n`
					console.warn('解析定时器时出错：缺少 <time> 或 <trigger>', itemContent)
					continue
				}
				if (timestr && triggerstr) {
					systemLogContent += `跳过无效条目“${reason}”：不能同时提供 <time> 和 <trigger> 标签。\n`
					console.warn('解析定时器时出错：同时提供了 <time> 和 <trigger>', itemContent)
					continue
				}

				let finalTrigger = triggerstr

				if (timestr)
					try {
						const timeInMs = parseDuration(timestr)
						if (repeat) finalTrigger = `Date.now() - ${Date.now() + timeInMs} % ${timeInMs} <= 1000`
						else finalTrigger = `Date.now() >= ${Date.now() + timeInMs}`
					}
					catch (e) {
						systemLogContent += `跳过错误条目 (原因: ${reason}): 时间="${timestr}" 解析失败: ${e.message}\n`
						console.warn('解析定时器时间时出错:', timestr, e)
						continue
					}

				console.info('AI设置定时器:', { trigger: finalTrigger, reason, repeat })

				timersToSet.push({
					trigger: finalTrigger,
					reason,
					repeat,
				})
			}

			if (timersToSet.length) {
				let successCount = 0
				for (const data of timersToSet)
					try {
						let uid = 0
						while (Object.keys(timers).includes(uid.toString())) uid++
						setTimer(args.username, 'chars', args.char_id, uid, {
							trigger: data.trigger,
							callbackdata: {
								type: 'timer',
								trigger: data.trigger,
								reason: data.reason,
								chat_log_snip: flatChatLog(args.chat_log.slice(-5)).map(e => e.name + ': ' + e.content).join('\n'),
								platform: args.extension?.platform,
							},
							repeat: data.repeat,
						})
						successCount++
					}
					catch (error) {
						systemLogContent += `设置定时器“${data.reason}”失败: ${error.stack}\n`
						console.error(`设置定时器“${data.reason}”时出错：`, error)
					}

				systemLogContent += `已设置${successCount}个定时器。\n`
				systemLogContent += '届时将触发新回复，现在你可以继续当前对话。\n'
			}
			else systemLogContent += '未找到有效的定时器条目进行设置。\n'

			AddLongTimeLog({
				name: 'timer',
				role: 'tool',
				content: systemLogContent,
				files: []
			})

		}


	if (result.content.match(/<list-timers>\s*<\/list-timers>/)) {
		processed = true
		const commandText = '<list-timers></list-timers>'

		tool_calling_log.content += commandText + '\n'
		if (!log_content_added) AddLongTimeLog(tool_calling_log)
		log_content_added = true
		console.info('AI请求列出定时器')

		AddLongTimeLog({
			name: 'timer',
			role: 'tool',
			content: '当前的定时器列表：\n' + (Object.values(timers).map(({ callbackdata }) => `- “${callbackdata.reason}”：${callbackdata.trigger}`).join('\n') || '无'),
			files: []
		})
	}

	const removeTimerMatches = [...result.content.matchAll(/<remove-timer>(?<reasons>.*?)<\/remove-timer>/gis)]
	for (const removeTimerMatch of removeTimerMatches)
		if (removeTimerMatch?.groups?.reasons) {
			processed = true
			const reasonsToRemove = removeTimerMatch.groups.reasons.trim().split('\n').map(e => e.trim())
			const fullMatch = removeTimerMatch[0]

			tool_calling_log.content += fullMatch + '\n'
			if (!log_content_added) AddLongTimeLog(tool_calling_log)
			log_content_added = true
			console.info('AI请求删除定时器:', reasonsToRemove)

			let systemLogContent = ''
			if (!reasonsToRemove.length) systemLogContent += '未提供要删除的定时器。\n'
			for (const reason of reasonsToRemove) {
				const timerUid = Object.keys(timers).find(uid => timers[uid].callbackdata.reason === reason)
				if (timerUid)
					try {
						removeTimer(args.username, 'chars', args.char_id, timerUid)
						systemLogContent += `已成功删除定时器：“${reason}”\n`
					}
					catch (error) {
						systemLogContent += `删除定时器“${reason}”失败: ${error.stack}\n`
						console.error('删除定时器时出错:', error)
					}
				else
					systemLogContent += `未找到定时器：“${reason}”\n`

			}

			AddLongTimeLog({
				name: 'timer',
				role: 'tool',
				content: systemLogContent,
				files: []
			})
		}


	tool_calling_log.content = tool_calling_log.content.trim()

	return processed
}
/**
 * 定时器回调函数。
 * @param {object} callbackdata - 回调数据。
 * @param {string} callbackdata.reason - 定时器的原因。
 * @param {string} callbackdata.chat_log_snip - 聊天记录片段。
 * @param {string} callbackdata.platform - 平台。
 */
export function timerCallBack(callbackdata) {
	const { reason, chat_log_snip, platform } = callbackdata
	statisticDatas.toolUsage.timerCallbacks++
	const logEntry = {
		name: 'system',
		role: 'system',
		content: `\
定时器“${reason}”到期
设置定时器时的聊天记录节选：
<chat_log_snip>
${chat_log_snip}
</chat_log_snip>
请你根据定时器相关回复或行动。
`,
		files: [],
		charVisibility: [charname],
	}
	UseNofityAbleChannel(async channel => {
		const result = await GetReply({
			...channel,
			chat_log: [...channel.chat_log, logEntry],
		})
		if (!result) return
		result.logContextBefore.push(logEntry)
		await channel.AddChatLogEntry({ name: '龙胆', ...result })
		newCharReplay(result.content, platform || 'chat')
	})
}
