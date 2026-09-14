/** @typedef {import("../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

import { defineReplyHandler, defineReplyHandlers } from '../../../../../../../src/public/parts/shells/chat/src/reply/defineReplyHandler.mjs'
import { addTodoTask, adjustIdleTaskWeight, deleteTodoTask, listTodoTasks, postponeIdleTask } from '../../event_engine/on-idle.mjs'
import { parseDuration } from '../../scripts/tools/index.mjs'

/**
 * 处理 `<adjust-idle-weight>`：调整闲置任务类别的权重。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {Function} args.AddLongTimeLog 追加工具结果日志
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function adjustIdleWeightHandle(reply, args, call) {
	const AddLongTimeLog = args.AddLongTimeLog
	const content = call.inner
	if (!content) return {}

	const categoryMatch = content.match(/<category>(.*?)<\/category>/is)
	const weightMatch = content.match(/<weight>(.*?)<\/weight>/is)

	const category = categoryMatch?.[1]?.trim()
	const weight = parseFloat(weightMatch?.[1]?.trim())

	let systemLogContent = ''
	if (category && !isNaN(weight)) {
		adjustIdleTaskWeight(category, weight)
		systemLogContent = `已将闲置任务类别 "${category}" 的权重调整为 ${weight}。`
	}
	else
		systemLogContent = `调整权重失败：无效的类别或权重值。\n类别: ${category}, 权重: ${weightMatch?.[1]}`

	AddLongTimeLog({
		name: 'system',
		uid: 'system',
		role: 'tool',
		content: systemLogContent,
		files: []
	})
	return { regen: true }
}

/**
 * 处理 `<postpone-idle>`：推迟下一次闲置任务的执行。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {Function} args.AddLongTimeLog 追加工具结果日志
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function postponeIdleHandle(reply, args, call) {
	const AddLongTimeLog = args.AddLongTimeLog
	const timeStr = call.inner.trim()
	if (!timeStr) return {}

	let systemLogContent = ''
	try {
		const duration = parseDuration(timeStr)
		postponeIdleTask(duration)
		systemLogContent = `已设置下一次闲置任务将在 ${timeStr} 后执行。`
	} catch (e) {
		systemLogContent = `设置闲置任务时间失败：无法解析时间 "${timeStr}"。错误: ${e.message}`
	}

	AddLongTimeLog({
		name: 'system',
		uid: 'system',
		role: 'tool',
		content: systemLogContent,
		files: []
	})
	return { regen: true }
}

/**
 * 处理 `<add-todo>`：添加一条待办任务。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {Function} args.AddLongTimeLog 追加工具结果日志
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function addTodoHandle(reply, args, call) {
	const AddLongTimeLog = args.AddLongTimeLog
	const content = call.inner
	if (!content) return {}

	const nameMatch = content.match(/<name>(.*?)<\/name>/is)
	const taskContentMatch = content.match(/<content>([\S\s]*?)<\/content>/is)
	const weightMatch = content.match(/<weight>(.*?)<\/weight>/is)
	const enablePromptsMatch = content.match(/<enable-prompts>([\S\s]*?)<\/enable-prompts>/is)

	const name = nameMatch?.[1]?.trim()
	const taskContent = taskContentMatch?.[1]?.trim()
	const weight = weightMatch ? parseFloat(weightMatch[1].trim()) : 10
	let enablePrompts = {}

	let systemLogContent = ''
	if (name && taskContent) {
		if (enablePromptsMatch)
			try {
				enablePrompts = JSON.parse(enablePromptsMatch[1].trim())
			} catch (e) {
				systemLogContent += `警告：无法解析 enable-prompts JSON，将使用默认值。错误: ${e.message}\n`
			}

		addTodoTask({
			name,
			content: taskContent,
			weight,
			enable_prompts: enablePrompts
		})
		systemLogContent += `已添加待办任务 "${name}"。`
	}
	else
		systemLogContent += '添加待办任务失败：缺少名称或内容。'

	AddLongTimeLog({
		name: 'system',
		uid: 'system',
		role: 'tool',
		content: systemLogContent,
		files: []
	})
	return { regen: true }
}

/**
 * 处理 `<delete-todo>`：删除指定待办任务。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {Function} args.AddLongTimeLog 追加工具结果日志
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function deleteTodoHandle(reply, args, call) {
	const AddLongTimeLog = args.AddLongTimeLog
	const name = call.inner.trim()
	if (!name) return {}

	deleteTodoTask(name)
	const systemLogContent = `已删除待办任务 "${name}"。`

	AddLongTimeLog({
		name: 'system',
		uid: 'system',
		role: 'tool',
		content: systemLogContent,
		files: []
	})
	return { regen: true }
}

/**
 * 处理 `<list-todos>`：列出当前待办任务。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {Function} args.AddLongTimeLog 追加工具结果日志
 * @returns {Promise<object>} 结果
 */
async function listTodosHandle(reply, args) {
	const AddLongTimeLog = args.AddLongTimeLog
	const todos = listTodoTasks()
	const systemLogContent = `当前待办任务列表：\n${todos.length ? todos.map(t => `- ${t.name} (权重: ${t.weight})`).join('\n') : '无'}`

	AddLongTimeLog({
		name: 'system',
		uid: 'system',
		role: 'tool',
		content: systemLogContent,
		files: []
	})
	return { regen: true }
}

/** @type {import("../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export const IdleManagementHandler = defineReplyHandlers([
	defineReplyHandler({ tag: 'adjust-idle-weight', handle: adjustIdleWeightHandle }),
	defineReplyHandler({ tag: 'postpone-idle', handle: postponeIdleHandle }),
	defineReplyHandler({ tag: 'add-todo', handle: addTodoHandle }),
	defineReplyHandler({ tag: 'delete-todo', handle: deleteTodoHandle }),
	defineReplyHandler({ tag: 'list-todos', handle: listTodosHandle }),
])
