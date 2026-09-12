import fs from 'node:fs'
import path from 'node:path'

import { loadJsonFileIfExists, saveJsonFile } from '../../../../../../../../src/scripts/json_loader.mjs'
import { chardir } from '../../../charbase.mjs'
import { createContextSnapshot } from '../../../scripts/context.mjs'
import { flatChatLog, isUserSpeaker, PreprocessChatLogEntry } from '../../../scripts/match.mjs'
import { findMostFrequentElement } from '../../../scripts/tools/index.mjs'

import { cleanupMemories } from './cleanup.mjs'
import { extractKeywordsFromChatLog } from './keywords.mjs'
import { calculateRelevance } from './scoring.mjs'
import { markCleanupTime, markSavedMemoryChatName, memories, replaceMemories } from './state.mjs'

/** @typedef {import('../../../scripts/match.mjs').chatReplyRequest_t} chatReplyRequest_t */

/**
 * 从磁盘加载短期记忆到运行时内存。
 */
export function loadShortTermMemoryFromDisk() {
	replaceMemories(loadJsonFileIfExists(path.join(chardir, 'memory/short-term-memory.json'), []))
	for (const mem of memories)
		mem.time_stamp = new Date(mem.time_stamp)
	markCleanupTime(new Date().getTime())
	cleanupMemories(new Date())
}

/**
 * 获取最频繁的聊天名称（用于统计主要互动的对象）
 * @returns {string} 最频繁的聊天名称
 */
export function getMostFrequentChatName() {
	return findMostFrequentElement(memories.map(x => x.chat_name)).element
}

/**
 * 获取当前分数最高的短期记忆（基于当前时间上下文计算）
 * @returns {object} 分数最高的短期记忆
 */
export function getHighestScoreShortTermMemory() {
	const currentTimeStamp = new Date()
	let max_relevance = -Infinity, result
	for (const mem of memories) {
		// 空关键词列表，纯粹基于时间（周期+新鲜度）和固有分数计算
		const relevance = calculateRelevance(mem, [], currentTimeStamp)
		if (relevance >= max_relevance) {
			max_relevance = relevance
			result = mem
		}
	}
	return result
}

/**
 * 保存短期记忆到文件。
 */
export function saveShortTermMemory() {
	cleanupMemories(new Date())
	fs.mkdirSync(path.join(chardir, 'memory'), { recursive: true })
	saveJsonFile(path.join(chardir, 'memory/short-term-memory.json'), memories)
}

/**
 * 删除指定关键词的记忆。
 * @param {string|RegExp} keyword - 要删除的记忆关键词或正则
 * @returns {number} - 删除的记忆数量
 */
export function deleteShortTermMemory(keyword) {
	const oldLength = memories.length
	replaceMemories(memories.filter(mem => !(keyword instanceof RegExp ? keyword.test(mem.text) : mem.text.includes(keyword))))
	saveShortTermMemory()
	return oldLength - memories.length
}

/**
 * 获取短期记忆数量。
 * @returns {number} - 短期记忆的数量
 */
export function getShortTermMemoryNum() {
	return memories.length
}

/**
 * 在回复完成后保存短期记忆（包含回复结果）。
 * @param {chatReplyRequest_t} args - 聊天回复请求参数（包含聊天记录）
 * @param {import("../../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReply_t} replyResult - 生成的回复结果
 */
export async function saveShortTermMemoryAfterReply(args, replyResult) {
	const currentTimeStamp = new Date()
	const currentChatName = args.chat_name

	// 构建包含回复结果的完整对话记录
	const memoryLogSlice = args.chat_log.slice(-10)

	// 只有非内部调用，且包含双方对话时才保存
	if (!args.extension?.is_internal &&
		memoryLogSlice.length &&
		memoryLogSlice.some(chatLogEntry => isUserSpeaker(chatLogEntry, args)) &&
		replyResult?.content
	) {
		const memoryLogWithReply = [...memoryLogSlice]
		if (replyResult.content)
			memoryLogWithReply.push({
				name: args.Charname,
				uid: args.CharUid,
				role: 'char',
				content: replyResult.content,
				time_stamp: currentTimeStamp,
				extension: {}
			})

		await Promise.all(memoryLogWithReply.map(PreprocessChatLogEntry))
		const newMemoryKeywords = await extractKeywordsFromChatLog(
			flatChatLog(memoryLogWithReply),
			args,
		)
		const memoryText = createContextSnapshot(memoryLogWithReply)

		if (memoryText.trim()) {
			const newMemory = {
				time_stamp: currentTimeStamp,
				text: memoryText,
				keywords: newMemoryKeywords,
				score: 0,
				chat_name: currentChatName
			}
			memories.push(newMemory)

			// 更新最后一次保存的记忆的频道名称
			markSavedMemoryChatName(currentChatName)
		}
		else
			console.warn('[Memory] Skipping saving new memory due to empty processed content.')

		// 5% 概率保存文件，减少 I/O
		if (Math.random() < 0.05) saveShortTermMemory()
	}
}
