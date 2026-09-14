/*
## 基于AI自定义逻辑的长期记忆

AI可以在返回内容中使用特定格式来创建永久记忆，其返回内容中必须拥有的内容是：
- 触发逻辑（js代码，不做安全考虑。毕竟角色已经可以全权掌控电脑了）
- prompt内容
- 名称

在prompt构建中所有永久记忆都会被map一遍，激活则加入prompt。

关于条目清理：
AI被允许使用特殊返回格式进行永久记忆的删除或更新。
*/

import { defineReplyHandler, defineReplyHandlers } from '../../../../../../../src/public/parts/shells/chat/src/reply/defineReplyHandler.mjs'
import { addLongTermMemory, deleteLongTermMemory, listLongTermMemory, updateLongTermMemory, testLongTermMemoryTrigger, getLongTermMemoryByName, formatLongTermMemoryContext } from '../../prompt/memory/long-term-memory.mjs'
import { createContextSnapshot } from '../../scripts/context.mjs'

/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */
/** @typedef {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} ReplyHandler_t */
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */

/**
 * 处理 `<add-long-term-memory>`：新增一条永久记忆。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function addLongTermMemoryHandle(reply, args, call) {
	const AddLongTimeLog = args.AddLongTimeLog
	const content = call.inner.trim()
	const triggerMatch = content.match(/<trigger>(?<trigger>.*?)<\/trigger>/s)
	const nameMatch = content.match(/<name>(?<name>.*?)<\/name>/s)
	const promptContentMatch = content.match(/<prompt-content>(?<prompt>.*?)<\/prompt-content>/s)

	const memoryTrigger = triggerMatch?.groups?.trigger?.trim()
	const memoryName = nameMatch?.groups?.name?.trim()
	const memoryPromptContent = promptContentMatch?.groups?.prompt?.trim()

	console.info('AI请求添加永久记忆:', { trigger: memoryTrigger, name: memoryName, prompt: memoryPromptContent })

	if (memoryTrigger && memoryName && memoryPromptContent)
		try {
			const contextSnapshot = createContextSnapshot(args.chat_log, 4)
			const newMemory = {
				trigger: memoryTrigger,
				name: memoryName,
				prompt: memoryPromptContent,
				createdAt: new Date(),
				createdContext: contextSnapshot
			}
			await testLongTermMemoryTrigger(newMemory, args, args.extension.logical_results, args.prompt_struct, 0)
			addLongTermMemory(newMemory)
			AddLongTimeLog({
				name: 'long-term-memory',
				role: 'tool',
				content: `已成功添加永久记忆："${memoryName}"`,
				files: []
			})
		}
		catch (err) {
			console.error(`Error adding long-term memory "${memoryName}":`, err)
			AddLongTimeLog({
				name: 'long-term-memory',
				role: 'tool',
				content: `添加永久记忆 "${memoryName}" 时出错：\n${err.message || err}`,
				files: []
			})
		}
	else
		AddLongTimeLog({
			name: 'long-term-memory',
			role: 'tool',
			content: `添加永久记忆失败：缺少 <trigger>, <name>, 或 <prompt-content> 标签。\n收到的内容:\n${content}`,
			files: []
		})

	return { regen: true }
}

/**
 * 处理 `<update-long-term-memory>`：更新一条永久记忆。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function updateLongTermMemoryHandle(reply, args, call) {
	const AddLongTimeLog = args.AddLongTimeLog
	const content = call.inner.trim()
	const nameMatch = content.match(/<name>(?<name>.*?)<\/name>/s)
	const triggerMatch = content.match(/<trigger>(?<trigger>.*?)<\/trigger>/s)
	const promptContentMatch = content.match(/<prompt-content>(?<prompt>.*?)<\/prompt-content>/s)

	const memoryName = nameMatch?.groups?.name?.trim()

	if (memoryName) {
		const memoryTrigger = triggerMatch?.groups?.trigger?.trim()
		const memoryPromptContent = promptContentMatch?.groups?.prompt?.trim()

		if (memoryTrigger || memoryPromptContent)
			try {
				const logPayload = { name: memoryName }
				if (memoryTrigger) logPayload.trigger = memoryTrigger
				if (memoryPromptContent) logPayload.prompt = memoryPromptContent
				console.info('AI请求更新永久记忆:', logPayload)

				if (memoryTrigger)
					await testLongTermMemoryTrigger({ trigger: memoryTrigger, name: memoryName, prompt: '' }, args, args.extension.logical_results, args.prompt_struct, 0)

				const contextSnapshot = createContextSnapshot(args.chat_log, 4)
				updateLongTermMemory({
					name: memoryName,
					trigger: memoryTrigger,
					prompt: memoryPromptContent,
					updatedAt: new Date(),
					updatedContext: contextSnapshot
				})

				AddLongTimeLog({
					name: 'long-term-memory',
					role: 'tool',
					content: `已成功更新永久记忆："${memoryName}"`,
					files: []
				})
			}
			catch (err) {
				console.error(`Error updating long-term memory "${memoryName}":`, err)
				AddLongTimeLog({
					name: 'long-term-memory',
					role: 'tool',
					content: `更新永久记忆 "${memoryName}" 时出错：\n${err.message || err}`,
					files: []
				})
			}
		else
			AddLongTimeLog({
				name: 'long-term-memory',
				role: 'tool',
				content: `更新永久记忆失败：必须提供 <trigger> 或 <prompt-content> 标签中的至少一个。\n收到的内容:\n${content}`,
				files: []
			})
	}
	else
		AddLongTimeLog({
			name: 'long-term-memory',
			role: 'tool',
			content: `更新永久记忆失败：缺少 <name> 标签。\n收到的内容:\n${content}`,
			files: []
		})

	return { regen: true }
}

/**
 * 处理 `<delete-long-term-memory>`：删除指定永久记忆。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {Function} args.AddLongTimeLog 追加工具结果日志
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function deleteLongTermMemoryHandle(reply, args, call) {
	const AddLongTimeLog = args.AddLongTimeLog
	const memoryName = call.inner.trim()

	console.info('AI请求删除永久记忆:', memoryName)

	if (memoryName)
		try {
			deleteLongTermMemory(memoryName)
			AddLongTimeLog({
				name: 'long-term-memory',
				role: 'tool',
				content: `已成功删除永久记忆："${memoryName}"`,
				files: []
			})
		}
		catch (err) {
			console.error(`Error deleting long-term memory "${memoryName}":`, err)
			AddLongTimeLog({
				name: 'long-term-memory',
				role: 'tool',
				content: `删除永久记忆 "${memoryName}" 时出错：\n${err.message || err}`,
				files: []
			})
		}
	else
		AddLongTimeLog({
			name: 'long-term-memory',
			role: 'tool',
			content: '删除永久记忆失败：<delete-long-term-memory> 标签内容为空。',
			files: []
		})

	return { regen: true }
}

/**
 * 处理 `<list-long-term-memory>`：列出全部永久记忆。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {Function} args.AddLongTimeLog 追加工具结果日志
 * @returns {Promise<object>} 结果
 */
async function listLongTermMemoryHandle(reply, args) {
	const AddLongTimeLog = args.AddLongTimeLog
	console.info('AI请求列出永久记忆')

	try {
		const memoryNames = listLongTermMemory()
		let listContent = '当前的永久记忆列表：\n'
		if (memoryNames.length)
			listContent += memoryNames.map(name => `- ${name}`).join('\n')
		else
			listContent += '(无)'

		AddLongTimeLog({
			name: 'long-term-memory',
			role: 'tool',
			content: listContent,
			files: []
		})
	}
	catch (err) {
		console.error('Error listing long-term memories:', err)
		AddLongTimeLog({
			name: 'long-term-memory',
			role: 'tool',
			content: `列出永久记忆时出错：\n${err.message || err}`,
			files: []
		})
	}

	return { regen: true }
}

/**
 * 处理 `<view-long-term-memory-context>`：查看指定永久记忆的创建/更新上下文。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {Function} args.AddLongTimeLog 追加工具结果日志
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function viewLongTermMemoryContextHandle(reply, args, call) {
	const AddLongTimeLog = args.AddLongTimeLog
	const memoryName = call.inner.trim()

	console.info('AI请求查看永久记忆上下文:', memoryName)

	if (memoryName)
		try {
			const memory = getLongTermMemoryByName(memoryName)
			const formattedContext = formatLongTermMemoryContext(memory)

			AddLongTimeLog({
				name: 'long-term-memory',
				role: 'tool',
				content: formattedContext,
				files: []
			})
		}
		catch (err) {
			console.error(`Error viewing context for long-term memory "${memoryName}":`, err)
			AddLongTimeLog({
				name: 'long-term-memory',
				role: 'tool',
				content: `查看永久记忆 "${memoryName}" 的上下文时出错：\n${err.message || err}`,
				files: []
			})
		}
	else
		AddLongTimeLog({
			name: 'long-term-memory',
			role: 'tool',
			content: '查看永久记忆上下文失败：<view-long-term-memory-context> 标签内容为空。',
			files: []
		})

	return { regen: true }
}

/**
 * 处理 AI 用于管理长期记忆（添加、删除、列出）的命令。
 * @type {ReplyHandler_t[]}
 */
export const longTermMemoryHandlers = [
	defineReplyHandler({ tag: 'add-long-term-memory', handle: addLongTermMemoryHandle }),
	defineReplyHandler({ tag: 'update-long-term-memory', handle: updateLongTermMemoryHandle }),
	defineReplyHandler({ tag: 'delete-long-term-memory', handle: deleteLongTermMemoryHandle }),
	defineReplyHandler({ tag: 'list-long-term-memory', handle: listLongTermMemoryHandle }),
	defineReplyHandler({ tag: 'view-long-term-memory-context', handle: viewLongTermMemoryContextHandle }),
]

/** @type {ReplyHandler_t} */
export const LongTermMemoryHandler = defineReplyHandlers(longTermMemoryHandlers)
