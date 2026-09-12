import { flatChatLog, match_keys, PreprocessChatLogEntry } from '../../../scripts/match.mjs'

import { cleanupMemories } from './cleanup.mjs'
import {
	BASE_RANDOM_WEIGHT,
	CLEANUP_INTERVAL_MS,
	MAX_NEXT_RELEVANT,
	MAX_RANDOM_FLASHBACK,
	MAX_SCORE_FOR_RANDOM_WEIGHT,
	MAX_TOP_RELEVANT,
	MEMORY_TTL_MS,
	MIN_TIME_DIFFERENCE_ANY_MS,
	MIN_TIME_DIFFERENCE_SAME_CHAT_MS,
	RANDOM_WEIGHT_RECENCY_FACTOR,
	RANDOM_WEIGHT_SCORE_FACTOR,
	RELEVANCE_THRESHOLD,
	SCORE_INCREMENT_NEXT,
	SCORE_INCREMENT_TOP,
} from './constants.mjs'
import { extractKeywordsFromChatLog } from './keywords.mjs'
import { calculateRelevance, selectOneWeightedRandom } from './scoring.mjs'
import { lastCleanupTime, lastSavedMemoryChatName, memories } from './state.mjs'

/** @typedef {import('./constants.mjs').MemoryEntry} MemoryEntry */
/** @typedef {import('../../../scripts/match.mjs').chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import('../../logical_results/index.mjs').logical_results_t} logical_results_t */

/**
 * 短期记忆处理主函数。
 * 负责：提取当前对话关键词 -> 检索相关记忆 -> 生成Prompt -> 记录新记忆。
 *
 * @param {chatReplyRequest_t} args 用户输入参数（包含聊天记录）
 * @param {logical_results_t} logical_results 逻辑结果
 * @returns {Promise<object>} 记忆组成的Prompt对象
 */
export async function ShortTermMemoryPrompt(args, logical_results) {
	const currentTimeStamp = new Date()
	const currentChatLog = args.chat_log
	const currentChatName = args.chat_name

	// 1. 处理当前对话：取最后5条记录提取关键词
	const recentLogSlice = currentChatLog.slice(-5)
	await Promise.all(recentLogSlice.map(PreprocessChatLogEntry))
	const currentKeywords = await extractKeywordsFromChatLog(
		flatChatLog(recentLogSlice),
		args,
	)

	// 2. 记忆评分：计算所有记忆与当前对话的相关性
	/** @type {{memory: MemoryEntry, relevance: number, index: number}[]} */
	const scoredMemories = memories
		.map((mem, index) => ({
			memory: mem,
			relevance: calculateRelevance(mem, currentKeywords, currentTimeStamp),
			index
		}))
		// 过滤掉不相关的
		.filter(item => item.relevance >= RELEVANCE_THRESHOLD)
		// 按相关性降序排列
		.sort((a, b) => b.relevance - a.relevance)

	// 3. 记忆选择策略：Top Relevant (高相关) 和 Next Relevant (次相关)
	const selectedIndices = new Set()
	const finalTopRelevant = []
	const finalNextRelevant = []
	const allSelectedRelevantMemories = [] // 用于检查时间冲突

	for (const candidateMemory of scoredMemories) {
		// 名额已满则停止
		if (finalTopRelevant.length >= MAX_TOP_RELEVANT && finalNextRelevant.length >= MAX_NEXT_RELEVANT) break

		const isFromSameChat = candidateMemory.memory.chat_name === currentChatName
		const timeDiffSinceMemory = currentTimeStamp.getTime() - candidateMemory.memory.time_stamp.getTime()

		// 过滤：如果是当前聊天的记忆，且发生时间太近（避免复读）
		if (isFromSameChat && timeDiffSinceMemory < MIN_TIME_DIFFERENCE_SAME_CHAT_MS)
			continue

		// 过滤：避免选中的记忆之间时间太近（避免把同一段对话拆成好几条塞进去）
		let isTooCloseToSelectedRelevant = false
		for (const selectedMem of allSelectedRelevantMemories)
			if (Math.abs(candidateMemory.memory.time_stamp.getTime() - selectedMem.memory.time_stamp.getTime()) < MIN_TIME_DIFFERENCE_ANY_MS) {
				isTooCloseToSelectedRelevant = true
				break
			}

		if (isTooCloseToSelectedRelevant) continue

		// 分配到 Top 或 Next 槽位
		if (finalTopRelevant.length < MAX_TOP_RELEVANT) {
			finalTopRelevant.push(candidateMemory)
			allSelectedRelevantMemories.push(candidateMemory)
			selectedIndices.add(candidateMemory.index)
		}
		else if (finalNextRelevant.length < MAX_NEXT_RELEVANT) {
			finalNextRelevant.push(candidateMemory)
			allSelectedRelevantMemories.push(candidateMemory)
			selectedIndices.add(candidateMemory.index)
		}
	}

	// 4. 记忆选择策略：随机回闪 (Random Flashback)
	// 从未被选中的记忆中，按权重随机抽取，模拟灵光一闪
	const finalRandomFlashback = []
	let availableForRandomPool = memories
		.map((mem, index) => ({ memory: mem, index }))
		.filter(item => !selectedIndices.has(item.index))

	for (let i = 0; i < MAX_RANDOM_FLASHBACK && availableForRandomPool.length; i++) {
		// 再次过滤时间冲突
		const currentCandidates = availableForRandomPool.filter(candidate => {
			const isFromSameChat = candidate.memory.chat_name === currentChatName
			const timeDiffSinceMemory = currentTimeStamp.getTime() - candidate.memory.time_stamp.getTime()

			if (isFromSameChat && timeDiffSinceMemory < MIN_TIME_DIFFERENCE_SAME_CHAT_MS)
				return false

			const allPreviouslySelected = [...allSelectedRelevantMemories, ...finalRandomFlashback]
			for (const selectedItem of allPreviouslySelected)
				if (Math.abs(candidate.memory.time_stamp.getTime() - selectedItem.memory.time_stamp.getTime()) < MIN_TIME_DIFFERENCE_ANY_MS)
					return false

			return true
		})

		if (!currentCandidates.length) break

		// 计算随机权重：新近度 + 分数
		const weights = currentCandidates.map(item => {
			const ageFactor = Math.max(0, 1 - (currentTimeStamp.getTime() - item.memory.time_stamp.getTime()) / MEMORY_TTL_MS)
			const cappedScore = Math.max(0, Math.min(item.memory.score, MAX_SCORE_FOR_RANDOM_WEIGHT))
			const normalizedScoreFactor = MAX_SCORE_FOR_RANDOM_WEIGHT > 0 ? cappedScore / MAX_SCORE_FOR_RANDOM_WEIGHT : 0

			// 基础权重 + 时间因子 + 分数因子
			const weight = BASE_RANDOM_WEIGHT
				+ ageFactor * RANDOM_WEIGHT_RECENCY_FACTOR
				+ normalizedScoreFactor * RANDOM_WEIGHT_SCORE_FACTOR
			return Math.max(0, weight)
		})

		const selectedRandomItem = selectOneWeightedRandom(currentCandidates, weights)

		if (selectedRandomItem) {
			selectedRandomItem.relevance = calculateRelevance(selectedRandomItem.memory, currentKeywords, currentTimeStamp)
			finalRandomFlashback.push(selectedRandomItem)
			// 移除已选，防止重复
			availableForRandomPool = availableForRandomPool.filter(item => item.index !== selectedRandomItem.index)
		}
		else {
			console.warn('[Memory] Failed to select a weighted random item, stopping random selection.')
			break
		}
	}

	// 5. 强化机制：被选中的记忆会增加分数（"回忆加强了记忆"）
	finalTopRelevant.forEach(item => {
		const memoryToUpdate = memories[item.index]
		if (memoryToUpdate) memoryToUpdate.score = Math.min(memoryToUpdate.score + SCORE_INCREMENT_TOP, 100)
	})
	finalNextRelevant.forEach(item => {
		const memoryToUpdate = memories[item.index]
		if (memoryToUpdate) memoryToUpdate.score = Math.min(memoryToUpdate.score + SCORE_INCREMENT_NEXT, 100)
	})

	// 5.5. 频道切换检查：如果上一次记忆的频道和当前不同，将最后一次记忆也加入 prompt
	if (lastSavedMemoryChatName && lastSavedMemoryChatName !== currentChatName && memories.length > 0) {
		// 找到最后一次保存的记忆（属于上一次频道的最后一次记忆，按时间戳排序取最新的）
		const lastMemory = [...memories]
			.filter(mem => mem.chat_name === lastSavedMemoryChatName)
			.sort((a, b) => b.time_stamp.getTime() - a.time_stamp.getTime())[0]

		if (lastMemory) {
			const lastMemoryIndex = memories.indexOf(lastMemory)
			// 检查是否已经被选中
			const isAlreadySelected = finalTopRelevant.some(item => item.index === lastMemoryIndex) ||
				finalNextRelevant.some(item => item.index === lastMemoryIndex) ||
				finalRandomFlashback.some(item => item.index === lastMemoryIndex)

			if (!isAlreadySelected && lastMemoryIndex !== -1)
				// 将最后一次记忆添加到次相关列表
				finalNextRelevant.push({
					memory: lastMemory,
					relevance: calculateRelevance(lastMemory, currentKeywords, currentTimeStamp),
					index: lastMemoryIndex
				})
		}
	}

	// 6. 构建 Prompt 字符串
	/**
	 * 格式化记忆条目为字符串
	 * @param {object} memoryItem - 记忆条目对象，包含 memory 属性
	 * @returns {string} 格式化后的记忆字符串
	 */
	function formatMemory(memoryItem) {
		const dateStr = memoryItem.memory.time_stamp.toLocaleString()
		return `\
记忆来自 ${memoryItem.memory.chat_name}, ${dateStr}：
${memoryItem.memory.text}
`
	}

	let result = '<memories>\n'
	if (finalTopRelevant.length)
		result += `\
高相关
${finalTopRelevant.map(formatMemory).join('\n')}
`
	if (finalNextRelevant.length)
		result += `\
次相关：
${finalNextRelevant.map(formatMemory).join('\n')}
`
	if (finalRandomFlashback.length)
		result += `\
随机：
${finalRandomFlashback.map(formatMemory).join('\n')}
`
	result += '</memories>\n'

	if (result.trim() === '<memories>\n</memories>\n') result = ''
	if (result)
		result += `\
这些是你的往期记忆，你不用回复记忆中的对话，它们是过去式的。
尽量不要重复以往的句式如重复的语句开头/结尾，多来点不一样的。
`

	// 7. 添加"删除记忆"的指令支持（如果配置启用或用户触发了关键词）
	if (
		args.extension?.enable_prompts?.ShortTermMemory || (
			await match_keys(args, ['删了', '清除', '丢掉', '丢弃', '舍弃', '移除', '清空', '忘了', '忘掉', '忘记', '删掉'], 'user') &&
			await match_keys(args, ['记忆'], 'user')
		)
	)
		result = `\
你可以通过以下格式删除涉及某词语的短期记忆（<memories> 标签内的内容）：
<delete-short-term-memories>关键词正则</delete-short-term-memories>
如：[
${args.UserCharname}: 给我把有关华为的记忆全忘掉。
龙胆: <delete-short-term-memories>/华为|Huawei/i</delete-short-term-memories>
]
你必须使用正则语法，且鼓励想到其他可能的情况（大小写、别称）来完善删除范围。
严禁使用脚本操作记忆的存档文件。
`

	// 8. 周期性清理
	if (currentTimeStamp.getTime() - lastCleanupTime > CLEANUP_INTERVAL_MS)
		cleanupMemories(currentTimeStamp)

	// 返回构建好的Prompt
	return {
		text: [{ content: result, important: 0 }],
		additional_chat_log: []
	}
}
