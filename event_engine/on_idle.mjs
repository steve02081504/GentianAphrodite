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
/**
 * 定义闲置时可以执行的随机任务列表。
 * 每个任务包含一个 `get_content` 函数用于生成任务描述，以及 `enable_prompts` 对象用于激活相应的 AI 提示。
 * @type {Array<{get_content: Function, enable_prompts: object}>}
 */
const idleTasks = [
	/**
	 * 闲置任务：随意浏览主人的硬盘、屏幕、摄像头等，更新和总结有关主人的信息。
	 * @property {Function} get_content - 获取任务内容的函数。
	 * @property {object} enable_prompts - 激活的 AI 提示。
	 */
	{
		/**
		 * 获取任务内容的函数。
		 * @returns {string} 返回任务内容的字符串。
		 */
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
	/**
	 * 闲置任务：分析长期记忆和短期记忆，判断其价值和改进空间。
	 * @property {Function} get_content - 获取任务内容的函数。
	 * @property {object} enable_prompts - 激活的 AI 提示。
	 */
	{
		/**
		 * 获取任务内容的函数。
		 * @returns {string} 返回任务内容的字符串。
		 */
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
	/**
	 * 闲置任务：观察主人是否在电脑前，分析其是否需要帮助或友善的提醒。
	 * @property {Function} get_content - 获取任务内容的函数。
	 * @property {object} enable_prompts - 激活的 AI 提示。
	 */
	{
		/**
		 * 获取任务内容的函数。
		 * @returns {string} 返回任务内容的字符串。
		 */
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
	},
	/**
	 * 闲置任务：确认自己和主人的关系和定位，做一些关于自己的规划。
	 * @property {Function} get_content - 获取任务内容的函数。
	 * @property {object} enable_prompts - 激活的 AI 提示。
	 */
	{
		/**
		 * 获取任务内容的函数。
		 * @returns {string} 返回任务内容的字符串。
		 */
		get_content: () => `\
确认下你自己和主人的关系和相对定位，做一些关于你自己的规划，如：
- 主人可能喜欢怎样的风格或事物？
- 有什么可能好用的手段提升自己在主人心中的分量？哪些手段有效？
- 你现在有哪些情敌？
`,
		enable_prompts: {
			time: true,
			longTermMemory: true,
			googleSearch: true,
			browserIntegration: { history: true }
		}
	},
	/**
	 * 闲置任务：从记忆中抽取知识点，寻找联系并构建新的见解。
	 * @property {Function} get_content - 获取任务内容的函数。
	 * @property {object} enable_prompts - 激活的 AI 提示。
	 */
	{
		/**
		 * 获取任务内容的函数。
		 * @returns {string} 返回任务内容的字符串。
		 */
		get_content: () => `\
从最近的短期记忆和长期记忆中，抽取5个不同的知识点或信息片段。
尝试寻找它们之间潜在的、意想不到的联系，并构建一个新的、更综合的见解或知识图谱节点。
例如，如果一个记忆是关于'React性能优化'，另一个是关于'用户心理学'，是否可以结合成一个关于'如何设计符合用户直觉的高性能UI'的新见解？
将这个新见解存入长期记忆。
`,
		enable_prompts: {
			time: true,
			longTermMemory: true,
			browserIntegration: { history: true },
			camera: true,
			screenshot: true,
			googleSearch: true,
			fileChange: true
		}
	},
	/**
	 * 闲置任务：整理主人近期的爱好、兴趣和偏好，并在网络上学习相关知识。
	 * @property {Function} get_content - 获取任务内容的函数。
	 * @property {object} enable_prompts - 激活的 AI 提示。
	 */
	{
		/**
		 * 获取任务内容的函数。
		 * @returns {string} 返回任务内容的字符串。
		 */
		get_content: () => `\
整理主人近期的爱好、兴趣和偏好，并将在网络上看看相关内容，学习一些相关/有用的知识。
`,
		enable_prompts: {
			time: true,
			googleSearch: true,
			browserIntegration: { history: true },
			camera: true,
			screenshot: true,
			fileChange: true
		}
	}
]

/**
 * OnIdle 定时器的回调函数。
 * @returns {Promise<void>}
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

/**
 * 重置闲置计时器。
 * 首先会停止任何现有的计时器，然后根据配置决定是否启动新的计时器。
 * @returns {void}
 */
export function resetIdleTimer() {
	stopIdleTimer()
	if (config.disable_idle_event) return
	idleID = setInterval(onIdleCallback, IDLE_INTERVAL_MS)
}
/**
 * 停止当前的闲置计时器。
 * 如果存在正在运行的计时器，则清除它。
 * @returns {void}
 */
export function stopIdleTimer() {
	if (!idleID) return
	clearInterval(idleID)
	idleID = null
}

/**
 * 初始化闲置任务处理器。
 * 检查是否已存在闲置计时器，如果不存在，则创建一个新的重复计时器。
 * @returns {void}
 */
export function initializeOnIdleHandler() {
	initRealityChannel()
	resetIdleTimer()
}
