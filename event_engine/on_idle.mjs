/** @typedef {import("../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */

import { charname } from '../charbase.mjs'
import { config } from '../config/index.mjs'
import { formatLongTermMemory, getRandomNLongTermMemories } from '../prompt/memory/long-term-memory.mjs'
import { GetReply } from '../reply_gener/index.mjs'

import { initRealityChannel, RealityChannel } from './index.mjs'

/**
 * 定义闲置时可以执行的随机任务列表。
 * @type {string[]}
 */
const idleTasks = [
	{
		get_content: () => '随意浏览主人的硬盘、屏幕、摄像头等，更新和总结有关主人的信息。',
		enable_prompts: {
			time: true,
			longTermMemory: true,
			browserIntegration: { history: true },
			CodeRunner: true,
			camera: true,
			screenshot: true,
			fileChange: true
		}
	},
	{
		get_content: () => `\
这是5条随机的长期记忆，并判断它们的内容是否没有帮助无需保留，或者它们的关键词列表是否有改进的空间。
以及判断近期的短期记忆中有什么有价值的内容可以加入到长期记忆中。
${getRandomNLongTermMemories(5).map(formatLongTermMemory).join('\n')}
`,
		enable_prompts: {
			time: true,
			longTermMemory: true
		}
	},
	{
		get_content: () => '观察主人现在是否在电脑前，分析其是否需要帮助或任何友善的提醒。',
		enable_prompts: {
			time: true,
			longTermMemory: true,
			browserIntegration: { history: true },
			CodeRunner: true,
			camera: true,
			screenshot: true,
			fileChange: true
		}
	}
]

/**
 * OnIdle 定时器的回调函数。
 */
export async function onIdleCallback() {
	const randomTask = idleTasks[Math.floor(Math.random() * idleTasks.length)]

	const logEntry = {
		name: 'system',
		role: 'system',
		content: `\n现在是闲置时间，上一次你和你主人的对话已经过去了一段时间，你可以自由地执行一些后台任务。
执行以下任务：
${randomTask.get_content()}
或者做一些别的你想做的。
`,
		files: [],
		charVisibility: [charname],
	}

	const result = await GetReply({
		...RealityChannel,
		chat_log: [...RealityChannel.chat_log, logEntry],
		extension: {
			...RealityChannel.extension,
			is_internal: true,
			enable_prompts: randomTask.enable_prompts
		}
	})
	if (!result) return
	result.logContextBefore.push(logEntry)
	await RealityChannel.AddChatLogEntry({ name: '龙胆', ...result })
}

const IDLE_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes
let idleID = null

export function resetIdleTimer() {
	stopIdleTimer()
	if (config.disable_idle_event) return
	idleID = setInterval(onIdleCallback, IDLE_INTERVAL_MS)
}
export function stopIdleTimer() {
	if (!idleID) return
	clearInterval(idleID)
	idleID = null
}

/**
 * 初始化闲置任务处理器。
 * 检查是否已存在闲置计时器，如果不存在，则创建一个新的重复计时器。
 */
export function initializeOnIdleHandler() {
	initRealityChannel()
	resetIdleTimer()
}
