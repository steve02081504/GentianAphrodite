/** @typedef {import("../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

import { addTodoTask, adjustIdleTaskWeight, deleteTodoTask, listTodoTasks, postponeIdleTask } from '../../event_engine/on-idle.mjs'
import { parseDuration } from '../../scripts/tools/index.mjs'

/** @type {import("../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export async function IdleManagementHandler(result, args) {
	const { AddLongTimeLog, MaskHandledCall } = args
	let processed = false
	const {content_for_handle} = result

	// 1. Adjust Idle Weight
	const adjustWeightMatches = [...content_for_handle.matchAll(/<adjust-idle-weight>(?<content>[\S\s]*?)<\/adjust-idle-weight>/gis)]
	for (const match of adjustWeightMatches)
		if (match?.groups?.content) {
			processed = true
			MaskHandledCall?.(match[0])
			const { content } = match.groups

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
		}

	// 2. Postpone Idle Task
	const postponeMatches = [...content_for_handle.matchAll(/<postpone-idle>(?<time>.*?)<\/postpone-idle>/gis)]
	for (const match of postponeMatches)
		if (match?.groups?.time) {
			processed = true
			MaskHandledCall?.(match[0])
			const timeStr = match.groups.time.trim()

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
		}

	// 3. Add Todo Task
	const addTodoMatches = [...content_for_handle.matchAll(/<add-todo>(?<content>[\S\s]*?)<\/add-todo>/gis)]
	for (const match of addTodoMatches)
		if (match?.groups?.content) {
			processed = true
			MaskHandledCall?.(match[0])
			const { content } = match.groups

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
		}

	// 4. Delete Todo Task
	const deleteTodoMatches = [...content_for_handle.matchAll(/<delete-todo>(?<name>.*?)<\/delete-todo>/gis)]
	for (const match of deleteTodoMatches)
		if (match?.groups?.name) {
			processed = true
			MaskHandledCall?.(match[0])
			const name = match.groups.name.trim()

			deleteTodoTask(name)
			const systemLogContent = `已删除待办任务 "${name}"。`

			AddLongTimeLog({
				name: 'system',
				uid: 'system',
				role: 'tool',
				content: systemLogContent,
				files: []
			})
		}

	// 5. List Todo Tasks
	const listMatch = content_for_handle.match(/<list-todos>\s*<\/list-todos>/)
	if (listMatch) {
		processed = true
		MaskHandledCall?.(listMatch[0])

		const todos = listTodoTasks()
		const systemLogContent = `当前待办任务列表：\n${todos.length ? todos.map(t => `- ${t.name} (权重: ${t.weight})`).join('\n') : '无'}`

		AddLongTimeLog({
			name: 'system',
			uid: 'system',
			role: 'tool',
			content: systemLogContent,
			files: []
		})
	}

	return processed
}
