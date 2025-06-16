import { loadJsonFileIfExists, saveJsonFile } from '../../../../../../../src/scripts/json_loader.mjs'
import { chardir } from '../../charbase.mjs'
import path from 'node:path'
import fs from 'node:fs'
import { flatChatLog, match_keys, PreprocessChatLogEntry } from '../../scripts/match.mjs'
import jieba from '../../scripts/jieba.mjs'
import { findMostFrequentElement } from '../../scripts/tools.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

// --- 常量定义 ---
const RELEVANCE_THRESHOLD = 5      // 激活相关记忆的阈值
const SCORE_INCREMENT_TOP = 5      // 高相关记忆分数增加值
const SCORE_INCREMENT_NEXT = 2     // 次相关记忆分数增加值
// -- 时间衰减 (优化) --
const TIME_DECAY_FACTOR_EXP = 2e-9 // 时间衰减因子（指数模型，需要仔细调整！）
const MAX_TIME_PENALTY = 15        // 时间衰减造成的最大分数惩罚值
// -- 随机选择权重 (优化) --
const BASE_RANDOM_WEIGHT = 1         // 基础权重，确保所有记忆都有机会
const RANDOM_WEIGHT_RECENCY_FACTOR = 1.7 // 随机选择中近期性权重因子 (可调整)
const RANDOM_WEIGHT_SCORE_FACTOR = 1.1   // 随机选择中分数权重因子 (可调整)
const MAX_SCORE_FOR_RANDOM_WEIGHT = 50  // 用于计算随机权重的最高分数上限
// -- 关键词提取 (优化) --
const KEYWORD_MIN_WEIGHT = 0.8       // 提取关键词的最低权重阈值 (可调整)
// -- 清理 --
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000 // 清理间隔（1天）
const MEMORY_TTL_MS = 365 * 24 * 60 * 60 * 1000 // 记忆最大存活时间（1年）
const CLEANUP_MIN_SCORE_THRESHOLD = -5 // 清理时，无关键词相关性的最低分数阈值
const MIN_RETAINED_MEMORIES = 512    // 清理后最少保留的记忆数量
// -- 激活逻辑去重/过滤 --
const MIN_TIME_DIFFERENCE_ANY_MS = 10 * 60 * 1000 // 10分钟，避免选取时间过近的*任何已选*记忆 (包括相关、次相关、随机之间)
const MIN_TIME_DIFFERENCE_SAME_CHAT_MS = 20 * 60 * 1000 // 20分钟，激活检查时跳过来自*同一个聊天*的近期记忆
const MAX_TOP_RELEVANT = 2 // 最多选几条最相关
const MAX_NEXT_RELEVANT = 1 // 最多选几条次相关
const MAX_RANDOM_FLASHBACK = 2 // 最多选几条随机

/**
 * @typedef {{
 *   word: string,
 *   weight: number
 * }} KeywordInfo
 */

/**
 * @typedef {{
 * 	timeStamp: number, // 记录时间戳
 * 	text: string,      // 原始对话文本片段 (最近10条)
 * 	keywords: KeywordInfo[], // 关键词及权重
 * 	score: number,     // 记忆分数
 * 	chat_name: string,  // 对话来源
 * }} MemoryEntry
 */

/** @type {MemoryEntry[]} */
let chat_memories = loadJsonFileIfExists(path.join(chardir, 'memory/short-term-memory.json'), [])
let lastCleanupTime = new Date().getTime()

export function getMostFrequentChatName() {
	return findMostFrequentElement(chat_memories.map(x => x.chat_name)).element
}

export function getHighestScoreShortTermMemory() {
	const currentTimeStamp = Date.now()
	let max_relevance = 0, result
	for (const mem of chat_memories) {
		const relevance = calculateRelevance(mem, [], currentTimeStamp)
		if (relevance >= max_relevance) {
			max_relevance = relevance
			result = mem
		}
	}

	return result
}

/**
 * 计算单个记忆条目的相关性分数 (优化时间衰减)
 * @param {MemoryEntry} memoryEntry - 历史记忆条目
 * @param {KeywordInfo[]} currentKeywords - 当前对话的关键词
 * @param {number} currentTimeStamp - 当前时间戳
 * @returns {number} - 相关性分数
 */
function calculateRelevance(memoryEntry, currentKeywords, currentTimeStamp) {
	let relevanceScore = 0
	const memoryKeywordsSet = new Set(memoryEntry.keywords.map(kw => kw.word))
	let keywordMatchScore = 0
	currentKeywords.forEach(currentKw => {
		if (memoryKeywordsSet.has(currentKw.word)) {
			const memoryKw = memoryEntry.keywords.find(mk => mk.word === currentKw.word)
			keywordMatchScore += currentKw.weight + (memoryKw?.weight || 0)
		}
	})
	relevanceScore += keywordMatchScore
	const timeDiff = Math.max(0, currentTimeStamp - memoryEntry.timeStamp)
	const timePenalty = MAX_TIME_PENALTY * (1 - Math.exp(-timeDiff * TIME_DECAY_FACTOR_EXP))
	relevanceScore -= timePenalty
	relevanceScore += memoryEntry.score
	return relevanceScore
}

/**
 * 清理旧的或不相关的记忆
 * @param {number} currentTimeStamp
 */
function cleanupMemories(currentTimeStamp) {
	const initialMemoryCount = chat_memories.length
	const oneYearAgo = currentTimeStamp - MEMORY_TTL_MS

	const passingMemories = []
	const failingMemories = []

	for (const mem of chat_memories) {
		mem.relevance = calculateRelevance(mem, [], currentTimeStamp)
		if (mem.timeStamp < oneYearAgo) failingMemories.push(mem)
		if (mem.relevance >= CLEANUP_MIN_SCORE_THRESHOLD) passingMemories.push(mem)
		else failingMemories.push(mem)
	}

	if (passingMemories.length >= MIN_RETAINED_MEMORIES)
		chat_memories = passingMemories
	else {
		// 达标的记忆数量不足 MIN_RETAINED_MEMORIES，需要从未达标的记忆中补充
		const neededFromFailing = MIN_RETAINED_MEMORIES - passingMemories.length
		failingMemories.sort((a, b) => b.relevance - a.relevance)
		// 取权重最高的 neededFromFailing 条未达标记忆
		const supplementaryMemories = failingMemories.slice(0, neededFromFailing)
		chat_memories = [...passingMemories, ...supplementaryMemories]
	}

	for (const mem of chat_memories) delete mem.relevance

	lastCleanupTime = currentTimeStamp
	if (initialMemoryCount !== chat_memories.length)
		console.log(`[Memory] Cleanup ran. Removed ${initialMemoryCount - chat_memories.length} entries. Current size: ${chat_memories.length}`)
}


/**
 * 加权随机选择 - 主要用于 *单次* 加权随机选择一个项
 * @template T
 * @param {T[]} items - 待选择项数组
 * @param {number[]} weights - 对应各项的权重
 * @returns {T | null} - 选中的项，如果无法选择则返回 null
 */
function selectOneWeightedRandom(items, weights) {
	if (!items || items.length === 0 || items.length !== weights.length)
		return null


	const totalWeight = weights.reduce((sum, w) => sum + Math.max(0, w), 0)
	if (totalWeight <= 0)
		// 如果总权重为0，随机选一个（或返回null，这里选择随机选一个）
		if (items.length > 0)
			return items[Math.floor(Math.random() * items.length)]
		else
			return null

	const randomVal = Math.random() * totalWeight
	let cumulativeWeight = 0

	for (let i = 0; i < items.length; i++) {
		const weight = Math.max(0, weights[i])
		cumulativeWeight += weight
		if (randomVal <= cumulativeWeight)
			return items[i]

	}

	// Fallback (should theoretically not be reached if totalWeight > 0)
	return items[items.length - 1]
}


/**
 * 短期记忆处理主函数
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function ShortTermMemoryPrompt(args, logical_results, prompt_struct, detail_level) {
	const currentTimeStamp = Date.now()
	const currentChatLog = args.chat_log
	const currentChatName = args.chat_name // 缓存当前聊天名称

	async function getKeyWords(chat_log) {
		const texts = chat_log.map(entry => entry.extension?.SimplifiedContents?.[0] || entry.content).filter(text => text.trim())
		const combinedText = texts.join('\n')
		const keywords = jieba.extract(combinedText, 72).filter(kw => kw.weight >= KEYWORD_MIN_WEIGHT)
		return keywords
	}

	// --- 2. 分析当前对话，提取关键词 ---
	const recentLogSlice = currentChatLog.slice(-5)
	await Promise.all(recentLogSlice.map(PreprocessChatLogEntry))
	const currentKeywords = await getKeyWords(flatChatLog(recentLogSlice))

	// --- 3. 计算所有记忆的相关性 ---
	/** @type {{memory: MemoryEntry, relevance: number, index: number}[]} */
	const scoredMemories = chat_memories
		.map((mem, index) => ({
			memory: mem,
			relevance: calculateRelevance(mem, currentKeywords, currentTimeStamp),
			index
		}))
		.filter(item => item.relevance >= RELEVANCE_THRESHOLD)
		.sort((a, b) => b.relevance - a.relevance)

	// --- 4. 选择相关和次相关记忆 (逻辑不变，但会影响后续随机选择的池子) ---
	const selectedIndices = new Set()
	const finalTopRelevant = []
	const finalNextRelevant = []
	const allSelectedRelevantMemories = [] // 用于相关/次相关内部的时间检查

	for (const candidateMemory of scoredMemories) {
		if (finalTopRelevant.length >= MAX_TOP_RELEVANT && finalNextRelevant.length >= MAX_NEXT_RELEVANT) break

		const isFromSameChat = candidateMemory.memory.chat_name === currentChatName
		const timeDiffSinceMemory = currentTimeStamp - candidateMemory.memory.timeStamp

		// 跳过来自同聊天的近期记忆 (相关/次相关选择时)
		if (isFromSameChat && timeDiffSinceMemory < MIN_TIME_DIFFERENCE_SAME_CHAT_MS)
			continue


		let isTooCloseToSelectedRelevant = false
		for (const selectedMem of allSelectedRelevantMemories)
			if (Math.abs(candidateMemory.memory.timeStamp - selectedMem.memory.timeStamp) < MIN_TIME_DIFFERENCE_ANY_MS) {
				isTooCloseToSelectedRelevant = true
				break
			}

		if (isTooCloseToSelectedRelevant) continue

		// 分配到 Top 或 Next
		if (finalTopRelevant.length < MAX_TOP_RELEVANT) {
			finalTopRelevant.push(candidateMemory)
			allSelectedRelevantMemories.push(candidateMemory)
			selectedIndices.add(candidateMemory.index)
		} else if (finalNextRelevant.length < MAX_NEXT_RELEVANT) {
			finalNextRelevant.push(candidateMemory)
			allSelectedRelevantMemories.push(candidateMemory)
			selectedIndices.add(candidateMemory.index)
		}
	}

	// --- 4.5 优化随机闪回选择逻辑 ---
	const finalRandomFlashback = [] // 最终选中的随机记忆 [{memory, index, relevance}]
	// 初始候选池：所有记忆中排除已被选为相关/次相关的
	let availableForRandomPool = chat_memories
		.map((mem, index) => ({ memory: mem, index }))
		.filter(item => !selectedIndices.has(item.index))

	// 迭代选择随机记忆，每次选择一个，并进行过滤
	for (let i = 0; i < MAX_RANDOM_FLASHBACK && availableForRandomPool.length > 0; i++) {
		// a. 过滤当前候选池
		const currentCandidates = availableForRandomPool.filter(candidate => {
			const isFromSameChat = candidate.memory.chat_name === currentChatName
			const timeDiffSinceMemory = currentTimeStamp - candidate.memory.timeStamp

			// 过滤条件1: 不能是来自同聊天的近期记忆 (20分钟内)
			if (isFromSameChat && timeDiffSinceMemory < MIN_TIME_DIFFERENCE_SAME_CHAT_MS)
				return false

			// 过滤条件2: 不能与 *任何已选* (相关、次相关、已选随机) 的记忆时间过近 (10分钟内)
			const allPreviouslySelected = [...allSelectedRelevantMemories, ...finalRandomFlashback] // 合并已选的相关/次相关 和 已选的随机
			for (const selectedItem of allPreviouslySelected)
				if (Math.abs(candidate.memory.timeStamp - selectedItem.memory.timeStamp) < MIN_TIME_DIFFERENCE_ANY_MS)
					return false // 时间太近，过滤掉

			return true // 通过所有过滤条件
		})

		// 如果过滤后没有候选者了，停止选择
		if (currentCandidates.length === 0) break

		// b. 计算剩余候选者的权重
		const weights = currentCandidates.map(item => {
			const ageFactor = Math.max(0, 1 - (currentTimeStamp - item.memory.timeStamp) / MEMORY_TTL_MS)
			const cappedScore = Math.max(0, Math.min(item.memory.score, MAX_SCORE_FOR_RANDOM_WEIGHT))
			const normalizedScoreFactor = MAX_SCORE_FOR_RANDOM_WEIGHT > 0 ? cappedScore / MAX_SCORE_FOR_RANDOM_WEIGHT : 0
			const weight = BASE_RANDOM_WEIGHT
				+ ageFactor * RANDOM_WEIGHT_RECENCY_FACTOR
				+ normalizedScoreFactor * RANDOM_WEIGHT_SCORE_FACTOR
			return Math.max(0, weight)
		})

		// c. 加权随机选择 *一个* 候选者
		const selectedRandomItem = selectOneWeightedRandom(currentCandidates, weights)

		// d. 如果成功选到一个
		if (selectedRandomItem) {
			// 计算其相关性（可选，但保持格式一致）
			selectedRandomItem.relevance = calculateRelevance(selectedRandomItem.memory, currentKeywords, currentTimeStamp)
			// 添加到最终列表
			finalRandomFlashback.push(selectedRandomItem)
			// 从 *主* 候选池中移除该项，防止下次迭代再次选中
			availableForRandomPool = availableForRandomPool.filter(item => item.index !== selectedRandomItem.index)
		} else {
			// 如果 selectOneWeightedRandom 返回 null (理论上权重>0时不应发生，除非 currentCandidates 为空)，也停止
			console.warn('[Memory] Failed to select a weighted random item, stopping random selection.')
			break
		}
	} // 结束随机选择的迭代

	// --- 5. 强化被激活的记忆 (逻辑不变) ---
	finalTopRelevant.forEach(item => {
		const memoryToUpdate = chat_memories[item.index]
		if (memoryToUpdate) memoryToUpdate.score = Math.min(memoryToUpdate.score + SCORE_INCREMENT_TOP, 100)
	})
	finalNextRelevant.forEach(item => {
		const memoryToUpdate = chat_memories[item.index]
		if (memoryToUpdate) memoryToUpdate.score = Math.min(memoryToUpdate.score + SCORE_INCREMENT_NEXT, 100)
	})

	// --- 6. 格式化选中的记忆以加入Prompt (使用最终列表) ---
	function formatMemory(memoryItem) {
		const dateStr = new Date(memoryItem.memory.timeStamp).toLocaleString()
		return `\
记忆来自 ${memoryItem.memory.chat_name}, ${dateStr}：
${memoryItem.memory.text}
`
	}

	let result = '<memories>\n'
	if (finalTopRelevant.length > 0)
		result += `\
高相关
${finalTopRelevant.map(formatMemory).join('\n')}
`
	if (finalNextRelevant.length > 0)
		result += `\
次相关：
${finalNextRelevant.map(formatMemory).join('\n')}
`
	if (finalRandomFlashback.length > 0)
		result += `\
随机：
${finalRandomFlashback.map(formatMemory).join('\n')}
`
	result += '</memories>'
	if (result.trim() === '<memories>\n</memories>') result = ''
	if (result)
		result += `\
这些是你的往期记忆，你不用回复记忆中的对话，它们是过去式的。
`

	if (
		await match_keys(args, ['删了', '清除', '丢掉', '丢弃', '舍弃', '移除', '清空', '忘了', '忘掉'], 'user') &&
		await match_keys(args, ['记忆'], 'user')
	)
		result = `\
你可以通过以下格式删除涉及某词语的短期记忆（<memories> 标签内的内容）：
<delete-short-term-memories>关键词正则</delete-short-term-memories>
如：[
${args.UserCharname}: 给我把有关华为的记忆全忘掉。
龙胆: <delete-short-term-memories>/华为|Huawei/i</delete-short-term-memories>
]
你必须使用正则语法，且鼓励想到其他可能的情况（大小写、别称）来完善删除范围。
`

	// --- 7. 执行清理 ---
	if (currentTimeStamp - lastCleanupTime > CLEANUP_INTERVAL_MS)
		cleanupMemories(currentTimeStamp)

	// --- 1. 保存新记忆 (逻辑不变) ---
	const memoryLogSlice = currentChatLog.slice(-10)
	if (memoryLogSlice.length &&
		memoryLogSlice.some(chatLogEntry => chatLogEntry.name == args.UserCharname) &&
		memoryLogSlice.some(chatLogEntry => chatLogEntry.name == args.Charname)
	) {
		const newMemoryKeywords = await getKeyWords(memoryLogSlice)
		const memoryText = flatChatLog(memoryLogSlice)
			.map(entry => `${entry.name || '未知发言者'}: ${entry.content || ''}${entry.files?.length ? `\n(文件: ${entry.files.map(file => file.name).join(', ')})` : ''}`)
			.join('\n')

		if (memoryText.trim())
			chat_memories.push({
				timeStamp: memoryLogSlice[memoryLogSlice.length - 1]?.timeStamp || currentTimeStamp,
				text: memoryText,
				keywords: newMemoryKeywords,
				score: 0,
				chat_name: currentChatName
			})
		else
			console.warn('[Memory] Skipping saving new memory due to empty processed content.')

		// 1/20概率保存
		if (Math.random() < 0.05) saveShortTermMemory()
	}

	// --- 8. 返回结果 ---
	return {
		text: [{ content: result, important: 0 }],
		additional_chat_log: []
	}
}

export function saveShortTermMemory() {
	cleanupMemories(Date.now())
	fs.mkdirSync(path.join(chardir, 'memory'), { recursive: true })
	saveJsonFile(path.join(chardir, 'memory/short-term-memory.json'), chat_memories)
}

export function deleteShortTermMemory(keyword) {
	const oldLength = chat_memories.length
	chat_memories = chat_memories.filter(mem => !(Object(keyword) instanceof RegExp ? keyword.test(mem.text) : mem.text.includes(keyword)))
	saveShortTermMemory()
	return oldLength - chat_memories.length
}
export function getShortTermMemoryNum() {
	return chat_memories.length
}
