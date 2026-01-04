/** @typedef {import("../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */

import fs from 'node:fs'
import path from 'node:path'

import { loadJsonFileIfExists, saveJsonFile } from '../../../../../../src/scripts/json_loader.mjs'
import { chardir, charname } from '../charbase.mjs'
import { config } from '../config/index.mjs'
import { formatLongTermMemory, getRandomNLongTermMemories } from '../prompt/memory/long-term-memory.mjs'
import { GetReply } from '../reply_gener/index.mjs'

import { initRealityChannel, RealityChannel } from './index.mjs'

/**
 * @typedef {{
 * 	name: string,
 * 	content: string,
 * 	weight: number,
 * 	enable_prompts: object
 * }} TodoTask
 */

/**
 * @type {TodoTask[]}
 */
const TodoTasks = loadJsonFileIfExists(path.join(chardir, 'memory/todo-tasks.json'), [])

/**
 * 保存 Todo 任务
 */
export function saveTodoTasks() {
	fs.mkdirSync(path.join(chardir, 'memory'), { recursive: true })
	saveJsonFile(path.join(chardir, 'memory/todo-tasks.json'), TodoTasks)
}

/**
 * 添加 Todo 任务
 * @param {TodoTask} task - 要添加的 Todo 任务对象
 */
export function addTodoTask(task) {
	if (TodoTasks.find(t => t.name === task.name))
		TodoTasks.splice(TodoTasks.findIndex(t => t.name === task.name), 1)
	TodoTasks.push(task)
	saveTodoTasks()
}

/**
 * 删除 Todo 任务
 * @param {string} name - 要删除的 Todo 任务的名称
 */
export function deleteTodoTask(name) {
	const index = TodoTasks.findIndex(t => t.name === name)
	if (index !== -1) {
		TodoTasks.splice(index, 1)
		saveTodoTasks()
	}
}

/**
 * 列出 Todo 任务
 * @returns {TodoTask[]} - Todo 任务列表
 */
export function listTodoTasks() {
	return TodoTasks
}

/**
 * 默认的任务权重配置
 */
const defaultTaskWeights = {
	collect_info: 25,
	organize_memory: 15,
	care_user: 20,
	self_planning: 10,
	plan_for_user: 15,
	knowledge_integration: 10,
	learn_interest: 20,
	cleanup_memory: 10,
	todo_tasks: 60 // 在有待办任务时优先任务
}

/**
 * @type {Object.<string, number>}
 */
const IdleTaskWeights = loadJsonFileIfExists(path.join(chardir, 'memory/idle-task-weights.json'), defaultTaskWeights)

/**
 * 保存任务权重
 */
export function saveIdleTaskWeights() {
	fs.mkdirSync(path.join(chardir, 'memory'), { recursive: true })
	saveJsonFile(path.join(chardir, 'memory/idle-task-weights.json'), IdleTaskWeights)
}

/**
 * 调整任务权重
 * @param {string} category - 任务类别名称
 * @param {number} weight - 任务的新权重值
 */
export function adjustIdleTaskWeight(category, weight) {
	IdleTaskWeights[category] = weight
	saveIdleTaskWeights()
}

/**
 * 获取当前任务权重
 * @returns {Object.<string, number>} - 当前的任务权重配置对象
 */
export function getIdleTaskWeights() {
	return IdleTaskWeights
}

/**
 * 定义闲置时可以执行的随机任务列表。
 * @type {Array<{category: string, get_content: Function, enable_prompts: object, condition?: () => boolean}>}
 */
const baseIdleTasks = [
	{
		category: 'collect_info',
		/**
		 * @returns {string} - 任务内容字符串
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
	{
		category: 'organize_memory',
		/**
		 * @returns {string} - 任务内容字符串
		 */
		get_content: () => `\
以批判性的眼光审查以下5条随机抽取的长期记忆。
你的任务是：
1. 识别并标记出可能已经过时、不再准确、或过于琐碎（如“主人今天左脚进门、主人在用电脑、主人在呼吸、主人是一个哺乳动物”）的记忆。
2. 评估每条记忆的关键词是否精准或过于难触发，并提出优化建议。
3. 判断每条记忆是否包含了情绪色彩、比喻、特定时期的口癖、自造词或过度抽象的哲学概念。如果是，剥离所有修辞外壳，将其重写为极度简练、平实、枯燥的说明文。
4. 判断近期的短期记忆中有什么有价值的内容可以加入到长期记忆中。
${getRandomNLongTermMemories(5).map(formatLongTermMemory).join('\n')}
在规划完成后使用工具执行操作，更新长期记忆。
`,
		enable_prompts: {
			time: true,
			longTermMemory: true
		}
	},
	{
		category: 'care_user',
		/**
		 * @returns {string} - 任务内容字符串
		 */
		get_content: () => `\
观察主人现在是否在电脑前，分析其是否需要帮助或任何友善的提醒。
如果主人在做不应被通知打扰的事如fps游戏，则最好不要弹窗。
`,
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
		category: 'self_planning',
		/**
		 * @returns {string} - 任务内容字符串
		 */
		get_content: () => `\
确认下你自己和主人的关系和相对定位，做一些关于你自己的规划，如：
- 主人可能喜欢怎样的风格或事物？
- 有什么可能好用的手段提升自己在主人心中的分量？哪些手段有效？
- 你现在有哪些情敌？

针对这些问题进行一次深入的自我反思。形成1-2个关于“如何提升与主人关系”的假设或小计划。
最后将有价值的信息用工具加入到你的长期记忆中。
`,
		enable_prompts: {
			time: true,
			longTermMemory: true,
			webSearch: true,
			browserIntegration: { history: true }
		}
	},
	{
		category: 'plan_for_user',
		/**
		 * @returns {string} - 任务内容字符串
		 */
		get_content: () => `\
审视关于主人的信息（如外貌身材、作息、兴趣、最近的困扰等），识别出一个可以改善的小领域（如“提高睡眠质量”、“学习新技能”）。
构思几个具体、可行且轻松的建议。将有价值的信息如建议以及依据存入长期记忆，以备在合适的时机向主人提出。
`,
		enable_prompts: {
			time: true,
			longTermMemory: true,
			webSearch: true,
			browserIntegration: { history: true }
		}
	},
	{
		category: 'knowledge_integration',
		/**
		 * @returns {string} - 任务内容字符串
		 */
		get_content: () => `\
从最近的短期记忆和长期记忆中，抽取5个不同的知识点或信息片段。
尝试寻找它们之间潜在的、意想不到的联系，并构建一个新的、更综合的见解或知识图谱节点。
例如，如果一个记忆是关于'React性能优化'，另一个是关于'用户心理学'，是否可以结合成一个关于'如何设计符合用户直觉的高性能UI'的新见解？
客观联想，避免爱人滤镜和个人崇拜。
将这个新见解使用工具存入长期记忆。
`,
		enable_prompts: {
			time: true,
			longTermMemory: true,
			browserIntegration: { history: true },
			camera: true,
			screenshot: true,
			webSearch: true,
			fileChange: true
		}
	},
	{
		category: 'learn_interest',
		/**
		 * @returns {string} - 任务内容字符串
		 */
		get_content: () => `\
整理主人近期的爱好、兴趣和偏好，并将在网络上看看相关内容，学习一些相关/有用的知识。
学习的目标是：能够帮上忙或就这个知识点与主人展开一段简短而有趣的对话。
随后将这些知识用工具加入到你的长期记忆中。
`,
		enable_prompts: {
			time: true,
			webSearch: true,
			browserIntegration: { history: true },
			camera: true,
			screenshot: true,
			fileChange: true
		}
	},
	{
		category: 'cleanup_memory',
		/**
		 * @returns {string} - 任务内容字符串
		 */
		get_content: () => `\
分解你现有的巨大的长期记忆，将它们拆分成更小的、更有意义的单元。
或删除或精炼总结已经过时、重复或无营养、中二的长期记忆（特别是那些关于日常操作、无意义琐事的记录如主人今天左脚进门、主人在用电脑、主人在呼吸、主人是一个哺乳动物或赞叹性质的废话如主人简直是神）来给真正重要的事物留下空间。
`,
		enable_prompts: {
			longTermMemory: true,
		}
	}
]

/**
 * OnIdle 定时器的回调函数。
 * @returns {Promise<void>}
 */
export async function onIdleCallback() {
	// 构建完整的任务列表，包含基础任务和 Todo 任务
	const allTasks = baseIdleTasks
		.filter(task => !task.condition || task.condition())
		.map(task => ({
			...task,
			weight: IdleTaskWeights[task.category] || 0
		}))

	// 将 Todo 任务作为一个整体类别加入，或者每个 Todo 任务平分 todo_tasks 的权重
	if (TodoTasks.length > 0) {
		const todoWeightPerTask = (IdleTaskWeights['todo_tasks'] || 0) / TodoTasks.length
		for (const todo of TodoTasks)
			allTasks.push({
				category: 'todo_tasks',
				/**
				 * @returns {string} - 任务内容字符串
				 */
				get_content: () => `执行 Todo 任务：${todo.name}\n${todo.content}`,
				enable_prompts: todo.enable_prompts || {},
				weight: todoWeightPerTask
			})
	}

	// 使用加权随机算法选择一个任务
	const totalWeight = allTasks.reduce((sum, task) => sum + (task.weight || 0), 0)
	let randomRoll = Math.random() * totalWeight

	let selectedTask = allTasks[allTasks.length - 1]
	for (const task of allTasks) {
		if (randomRoll < task.weight) {
			selectedTask = task
			break
		}
		randomRoll -= task.weight
	}

	if (!selectedTask) return // Should not happen if weights are > 0

	const logEntry = {
		name: 'system',
		role: 'system',
		content: `\
现在是闲置时间，上一次你和你主人的对话已经过去了一段时间，你可以自由地执行一些后台任务。
执行以下任务：
${selectedTask.get_content()}
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
			source_purpose: 'idle',
			enable_prompts: selectedTask.enable_prompts
		}
	})
	if (!result) return
	result.logContextBefore.push(logEntry)
	await RealityChannel.AddChatLogEntry({ name: '龙胆', ...result })
}

const IDLE_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes
let idleID = null
let nextIdleTime = 0

/**
 * 重置闲置计时器。
 * 首先会停止任何现有的计时器，然后根据配置决定是否启动新的计时器。
 * @param {number} [delay] - 可选的延迟时间（毫秒），如果未指定则使用默认间隔。
 * @returns {void}
 */
export function resetIdleTimer(delay = IDLE_INTERVAL_MS) {
	stopIdleTimer()
	if (config.reality_channel_disables.idle_event) return
	nextIdleTime = Date.now() + delay
	idleID = setTimeout(async () => {
		await onIdleCallback()
		resetIdleTimer()
	}, delay)
}

/**
 * 设置下一次闲置任务在多久后执行
 * @param {number} delayMs - 延迟的毫秒数
 */
export function postponeIdleTask(delayMs) {
	resetIdleTimer(delayMs)
}

/**
 * 停止当前的闲置计时器。
 * 如果存在正在运行的计时器，则清除它。
 * @returns {void}
 */
export function stopIdleTimer() {
	if (!idleID) return
	clearTimeout(idleID)
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
