import { CLEANUP_MIN_SCORE_THRESHOLD, MEMORY_TTL_MS, MIN_RETAINED_MEMORIES } from './constants.mjs'
import { calculateRelevance } from './scoring.mjs'
import { markCleanupTime, memories, replaceMemories } from './state.mjs'

/**
 * 清理旧的或不相关的记忆。
 * 策略：保留最近一年的，按相关性排序，至少保留 MIN_RETAINED_MEMORIES 条。
 * @param {Date} currentTimeStamp 当前时间戳
 */
export function cleanupMemories(currentTimeStamp) {
	const initialMemoryCount = memories.length
	const oneYearAgo = currentTimeStamp.getTime() - MEMORY_TTL_MS

	const passingMemories = []
	const failingMemories = []

	for (const mem of memories) {
		// 使用空关键词计算基础相关性（主要看时间和固有分数）
		mem.relevance = calculateRelevance(mem, [], currentTimeStamp)

		// 如果太旧，归入失败组
		if (mem.time_stamp.getTime() < oneYearAgo) failingMemories.push(mem)
		// 如果相关性达标，归入保留组
		else if (mem.relevance >= CLEANUP_MIN_SCORE_THRESHOLD) passingMemories.push(mem)
		else failingMemories.push(mem)
	}

	// 如果保留组不够数量，从失败组里捞回相关性最高的
	if (passingMemories.length >= MIN_RETAINED_MEMORIES)
		replaceMemories(passingMemories)
	else {
		const neededFromFailing = MIN_RETAINED_MEMORIES - passingMemories.length
		failingMemories.sort((a, b) => b.relevance - a.relevance)
		const supplementaryMemories = failingMemories.slice(0, neededFromFailing)
		replaceMemories([...passingMemories, ...supplementaryMemories])
	}

	// 清理临时属性
	for (const mem of memories) delete mem.relevance

	markCleanupTime(currentTimeStamp.getTime())
	if (initialMemoryCount !== memories.length)
		console.log(`[Memory] Cleanup ran. Removed ${initialMemoryCount - memories.length} entries. Current size: ${memories.length}`)
}
