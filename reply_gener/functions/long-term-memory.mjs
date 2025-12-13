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

import { addLongTermMemory, deleteLongTermMemory, listLongTermMemory, updateLongTermMemory, testLongTermMemoryTrigger, getLongTermMemoryByName, formatLongTermMemoryContext } from '../../prompt/memory/long-term-memory.mjs'
import { createContextSnapshot } from '../../scripts/context.mjs'

/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */
/** @typedef {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} ReplyHandler_t */
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */

/**
 * 处理 AI 用于管理长期记忆（添加、删除、列出）的命令。
 * 已更新以支持包含 <trigger> 和 <prompt-content> 的新 <add-long-term-memory> 格式。
 * @type {ReplyHandler_t}
 */
export async function LongTermMemoryHandler(result, args) {
	const { AddLongTimeLog } = args
	let processed = false // Flag to indicate if any LTM command was handled
	const tool_calling_log = {
		name: '龙胆',
		role: 'char',
		content: '',
		files: []
	}
	let log_content_added = false // Track if we added any content to the char log

	// --- Handle <add-long-term-memory> ---
	// Match the outer tag, capturing all inner content
	const addMatches = [...result.content.matchAll(/<add-long-term-memory>(?<content>.*?)<\/add-long-term-memory>/gs)]
	for (const addMatch of addMatches)
		if (addMatch?.groups?.content) {
			const content = addMatch.groups.content.trim()
			// Match the inner tags based on the new structure
			const triggerMatch = content.match(/<trigger>(?<trigger>.*?)<\/trigger>/s)
			const nameMatch = content.match(/<name>(?<name>.*?)<\/name>/s)
			const promptContentMatch = content.match(/<prompt-content>(?<prompt>.*?)<\/prompt-content>/s) // Changed from <memory-prompt>

			// Extract the values, trimming whitespace
			const memoryTrigger = triggerMatch?.groups?.trigger?.trim()
			const memoryName = nameMatch?.groups?.name?.trim()
			const memoryPromptContent = promptContentMatch?.groups?.prompt?.trim() // Changed variable name for clarity

			const logEntry = `<add-long-term-memory>${addMatch.groups.content}</add-long-term-memory>\n`
			tool_calling_log.content += logEntry
			if (!log_content_added) AddLongTimeLog(tool_calling_log)
			log_content_added = true
			// Updated log to include trigger
			console.info('AI请求添加永久记忆:', { trigger: memoryTrigger, name: memoryName, prompt: memoryPromptContent })

			// Validate that all required fields were found
			if (memoryTrigger && memoryName && memoryPromptContent)
				try {
					const contextSnapshot = createContextSnapshot(args.chat_log, 4)
					// Create the memory object using the extracted values
					const newMemory = {
						trigger: memoryTrigger, // Store the trigger string
						name: memoryName,
						prompt: memoryPromptContent, // Use the correct prompt content
						createdAt: new Date(),
						createdContext: contextSnapshot
					}
					await testLongTermMemoryTrigger(newMemory, args, args.extension.logical_results, args.prompt_struct, 0) // Test the trigger for errors
					addLongTermMemory(newMemory) // Use the helper function
					AddLongTimeLog({
						name: 'long-term-memory',
						role: 'tool',
						content: `已成功添加永久记忆："${memoryName}"`,
						files: []
					})
					processed = true
				}
				catch (err) {
					console.error(`Error adding long-term memory "${memoryName}":`, err)
					AddLongTimeLog({
						name: 'long-term-memory',
						role: 'tool',
						content: `添加永久记忆 "${memoryName}" 时出错：\n${err.message || err}`,
						files: []
					})
					processed = true // Still processed, even if failed
				}
			else {
				// Updated error message to reflect the required tags
				AddLongTimeLog({
					name: 'long-term-memory',
					role: 'tool',
					content: `添加永久记忆失败：缺少 <trigger>, <name>, 或 <prompt-content> 标签。\n收到的内容:\n${content}`,
					files: []
				})
				processed = true // Processed the tag, but it was invalid
			}
		}


	// --- Handle <update-long-term-memory> ---
	const updateMatches = [...result.content.matchAll(/<update-long-term-memory>(?<content>.*?)<\/update-long-term-memory>/gs)]
	for (const updateMatch of updateMatches)
		if (updateMatch?.groups?.content) {
			const content = updateMatch.groups.content.trim()
			const nameMatch = content.match(/<name>(?<name>.*?)<\/name>/s)
			const triggerMatch = content.match(/<trigger>(?<trigger>.*?)<\/trigger>/s)
			const promptContentMatch = content.match(/<prompt-content>(?<prompt>.*?)<\/prompt-content>/s)

			const memoryName = nameMatch?.groups?.name?.trim()

			const logEntry = `<update-long-term-memory>${updateMatch.groups.content}</update-long-term-memory>\n`
			tool_calling_log.content += logEntry
			if (!log_content_added) AddLongTimeLog(tool_calling_log)
			log_content_added = true

			if (memoryName) {
				const memoryTrigger = triggerMatch?.groups?.trigger?.trim()
				const memoryPromptContent = promptContentMatch?.groups?.prompt?.trim()

				if (memoryTrigger !== undefined || memoryPromptContent !== undefined)
					try {
						const logPayload = { name: memoryName }
						if (memoryTrigger !== undefined) logPayload.trigger = memoryTrigger
						if (memoryPromptContent !== undefined) logPayload.prompt = memoryPromptContent
						console.info('AI请求更新永久记忆:', logPayload)

						// Test trigger if it's being updated
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
						processed = true
					}
					catch (err) {
						console.error(`Error updating long-term memory "${memoryName}":`, err)
						AddLongTimeLog({
							name: 'long-term-memory',
							role: 'tool',
							content: `更新永久记忆 "${memoryName}" 时出错：\n${err.message || err}`,
							files: []
						})
						processed = true // Still processed, even if failed
					}
				else {
					AddLongTimeLog({
						name: 'long-term-memory',
						role: 'tool',
						content: `更新永久记忆失败：必须提供 <trigger> 或 <prompt-content> 标签中的至少一个。\n收到的内容:\n${content}`,
						files: []
					})
					processed = true // Processed the tag, but it was invalid
				}
			}
			else {
				AddLongTimeLog({
					name: 'long-term-memory',
					role: 'tool',
					content: `更新永久记忆失败：缺少 <name> 标签。\n收到的内容:\n${content}`,
					files: []
				})
				processed = true // Processed the tag, but it was invalid
			}
		}


	// --- Handle <delete-long-term-memory> ---
	const deleteMatches = [...result.content.matchAll(/<delete-long-term-memory>(?<name>.*?)<\/delete-long-term-memory>/gs)]
	for (const deleteMatch of deleteMatches)
		if (deleteMatch?.groups?.name) {
			const memoryName = deleteMatch.groups.name.trim()

			const logEntry = `<delete-long-term-memory>${deleteMatch.groups.name}</delete-long-term-memory>\n`
			tool_calling_log.content += logEntry
			if (!log_content_added) AddLongTimeLog(tool_calling_log)
			log_content_added = true
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

					processed = true
				}
				catch (err) {
					console.error(`Error deleting long-term memory "${memoryName}":`, err)
					AddLongTimeLog({
						name: 'long-term-memory',
						role: 'tool',
						content: `删除永久记忆 "${memoryName}" 时出错：\n${err.message || err}`,
						files: []
					})
					processed = true // Still processed, even if failed
				}
			else {
				AddLongTimeLog({
					name: 'long-term-memory',
					role: 'tool',
					content: '删除永久记忆失败：<delete-long-term-memory> 标签内容为空。',
					files: []
				})
				processed = true // Processed the tag, but it was invalid
			}
		}


	// --- Handle <list-long-term-memory> ---
	if (result.content.includes('<list-long-term-memory></list-long-term-memory>')) {
		const logEntry = '<list-long-term-memory></list-long-term-memory>\n'
		tool_calling_log.content += logEntry
		if (!log_content_added) AddLongTimeLog(tool_calling_log)
		log_content_added = true
		console.info('AI请求列出永久记忆')

		try {
			const memoryNames = listLongTermMemory() // Use the helper function
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
			processed = true
		}
		catch (err) {
			console.error('Error listing long-term memories:', err)
			AddLongTimeLog({
				name: 'long-term-memory',
				role: 'tool',
				content: `列出永久记忆时出错：\n${err.message || err}`,
				files: []
			})
			processed = true // Still processed, even if failed
		}
	}

	// --- Handle <view-long-term-memory-context> ---
	const viewContextMatches = [...result.content.matchAll(/<view-long-term-memory-context>(?<name>.*?)<\/view-long-term-memory-context>/gs)]
	for (const viewContextMatch of viewContextMatches)
		if (viewContextMatch?.groups?.name) {
			const memoryName = viewContextMatch.groups.name.trim()

			const logEntry = `<view-long-term-memory-context>${viewContextMatch.groups.name}</view-long-term-memory-context>\n`
			tool_calling_log.content += logEntry
			if (!log_content_added) AddLongTimeLog(tool_calling_log)
			log_content_added = true
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
					processed = true
				}
				catch (err) {
					console.error(`Error viewing context for long-term memory "${memoryName}":`, err)
					AddLongTimeLog({
						name: 'long-term-memory',
						role: 'tool',
						content: `查看永久记忆 "${memoryName}" 的上下文时出错：\n${err.message || err}`,
						files: []
					})
					processed = true // Still processed, even if failed
				}
			else {
				AddLongTimeLog({
					name: 'long-term-memory',
					role: 'tool',
					content: '查看永久记忆上下文失败：<view-long-term-memory-context> 标签内容为空。',
					files: []
				})
				processed = true // Processed the tag, but it was invalid
			}
		}



	// Return true if any LTM command was found and processed
	return processed
}
