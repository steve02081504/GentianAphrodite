import fs from 'node:fs'
import path from 'node:path'

import { loadJsonFileIfExists, saveJsonFile } from '../../../../../../../src/scripts/json_loader.mjs'
import { chardir } from '../../charbase.mjs'
import { createContextSnapshot } from '../../scripts/context.mjs'
import jieba from '../../scripts/jieba.mjs'
import { flatChatLog, match_keys, PreprocessChatLogEntry } from '../../scripts/match.mjs'
import { findMostFrequentElement } from '../../scripts/tools.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

// 相关性阈值：只有得分超过5的记忆才会被视为潜在相关
const RELEVANCE_THRESHOLD = 5
// 记忆被选中后的分数奖励（强化记忆）：
const SCORE_INCREMENT_TOP = 5    // 被选为"高相关"时增加的分数
const SCORE_INCREMENT_NEXT = 2   // 被选为"次相关"时增加的分数

// 时间衰减因子：用于模拟遗忘，随着时间推移，记忆的相关性会下降
const TIME_DECAY_FACTOR_EXP = 2e-9
const MAX_TIME_PENALTY = 15      // 最大因时间久远扣除的分数

// 时间周期性加成：模拟人类更容易回忆起"一天中同一时刻"发生的事（如早晨想起早晨的事）
const TIME_OF_DAY_MAX_BONUS = 3
const TIME_OF_DAY_STD_DEV_MINUTES = 120 // 标准差，约2小时，决定时间窗口的宽窄

// 随机回闪（Flashback）的权重配置
const BASE_RANDOM_WEIGHT = 1
const RANDOM_WEIGHT_RECENCY_FACTOR = 1.7 // 越新的记忆越容易随机浮现
const RANDOM_WEIGHT_SCORE_FACTOR = 1.1   // 分数越高的记忆越容易随机浮现
const MAX_SCORE_FOR_RANDOM_WEIGHT = 50

// 关键词提取配置
const KEYWORD_MIN_WEIGHT = 0.8 // 只有权重高的词才会被视为关键词

// 内存清理与保留配置
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000     // 每24小时清理一次
const MEMORY_TTL_MS = 365 * 24 * 60 * 60 * 1000     // 记忆保留有效期（1年）
const CLEANUP_MIN_SCORE_THRESHOLD = -5              // 清理时，相关性低于此分数的记忆可能被删除
const MIN_RETAINED_MEMORIES = 512                   // 即使分数低，最少也要保留这么条记忆
const MIN_TIME_DIFFERENCE_ANY_MS = 10 * 60 * 1000        // 不同记忆之间的时间间隔至少10分钟（避免同一对话的重复片段）
const MIN_TIME_DIFFERENCE_SAME_CHAT_MS = 20 * 60 * 1000  // 如果是当前对话的记忆，需要间隔20分钟才会被提取（避免复读刚才说的话）

// 最终Prompt中包含的记忆数量上限
const MAX_TOP_RELEVANT = 2
const MAX_NEXT_RELEVANT = 1
const MAX_RANDOM_FLASHBACK = 2

/**
 * 关键词结构
 * @typedef {{
 *   word: string,
 *   weight: number
 * }} KeywordInfo
 */

/**
 * 记忆条目结构
 * @typedef {{
 * 	time_stamp: Date,       // 记忆发生的时间
 * 	text: string,           // 记忆文本内容（通常是对话快照）
 * 	keywords: KeywordInfo[],// 包含的关键词及其权重
 * 	score: number,          // 记忆的基础分数（会被强化或遗忘）
 * 	chat_name: string,      // 来源的聊天/会话名称
 * }} MemoryEntry
 */

// ================= 初始化逻辑 =================

/** @type {MemoryEntry[]} 全局内存中的记忆列表 */
let chat_memories = loadJsonFileIfExists(path.join(chardir, 'memory/short-term-memory.json'), [])

// 确保时间戳是 Date 对象
for (const mem of chat_memories)
	mem.time_stamp = new Date(mem.time_stamp)

let lastCleanupTime = new Date().getTime()

// 跟踪最后一次保存的记忆的频道名称，用于频道切换时加入最后一次记忆
/** @type {string | null} */
let lastSavedMemoryChatName = null

// 启动时执行一次清理
cleanupMemories(new Date())

// ================= 导出工具函数 =================

/**
 * 获取最频繁的聊天名称（用于统计主要互动的对象）
 * @returns {string} 最频繁的聊天名称
 */
export function getMostFrequentChatName() {
	return findMostFrequentElement(chat_memories.map(x => x.chat_name)).element
}

/**
 * 获取当前分数最高的短期记忆（基于当前时间上下文计算）
 * @returns {MemoryEntry} 分数最高的短期记忆
 */
export function getHighestScoreShortTermMemory() {
	const currentTimeStamp = new Date()
	let max_relevance = -Infinity, result
	for (const mem of chat_memories) {
		// 空关键词列表，纯粹基于时间（周期+新鲜度）和固有分数计算
		const relevance = calculateRelevance(mem, [], currentTimeStamp)
		if (relevance >= max_relevance) {
			max_relevance = relevance
			result = mem
		}
	}
	return result
}

// ================= 核心算法函数 =================

/**
 * 从聊天日志中提取加权关键词（提取核心逻辑）
 * @param {chatLogEntry_t[]} chat_log - 聊天记录数组
 * @param {string} UserCharname - 用户角色名
 * @param {string} Charname - AI角色名
 * @returns {Promise<KeywordInfo[]>} - 关键词列表
 */
async function extractKeywordsFromChatLog(chat_log, UserCharname, Charname) {
	const keywordMap = {}

	for (const entry of chat_log) {
		// 优先使用 SimplifiedContents (可能的预处理文本)，否则用 content
		const text = entry.extension?.SimplifiedContents?.[0] || entry.content
		if (!text?.trim()) continue

		// 权重加成：当前角色(User/Char)说的话权重更高
		let multiplier = 1.0
		if (entry.name == Charname) multiplier = 2.0
		else if (entry.name == UserCharname) multiplier = 2.7

		// 使用 Jieba 提取关键词
		for (const kw of jieba.extract(text, 72))
			keywordMap[kw.word] = kw.weight * multiplier + (keywordMap[kw.word] || 0)
	}

	// 格式化并排序，取前72个
	return Object.entries(keywordMap).map(([word, weight]) => ({ word, weight }))
		.filter(kw => kw.weight >= KEYWORD_MIN_WEIGHT)
		.sort((a, b) => b.weight - a.weight)
		.slice(0, 72)
}

/**
 * 计算单个记忆条目的相关性分数
 * 核心算法包含三个部分：关键词匹配度 + 时间周期性匹配 + 时间衰减
 *
 * @param {MemoryEntry} memoryEntry - 历史记忆条目
 * @param {KeywordInfo[]} currentKeywords - 当前对话上下文提取的关键词
 * @param {Date} currentTimeStamp - 当前时间戳
 * @returns {number} - 综合相关性分数
 */
function calculateRelevance(memoryEntry, currentKeywords, currentTimeStamp) {
	let relevanceScore = 0

	// 1. 关键词匹配分数
	// 如果当前对话提到的词出现在记忆中，累加双方权重
	const memoryKeywordsSet = new Set(memoryEntry.keywords.map(kw => kw.word))
	let keywordMatchScore = 0
	currentKeywords.forEach(currentKw => {
		if (memoryKeywordsSet.has(currentKw.word)) {
			const memoryKw = memoryEntry.keywords.find(mk => mk.word === currentKw.word)
			keywordMatchScore += currentKw.weight + (memoryKw?.weight || 0)
		}
	})
	relevanceScore += keywordMatchScore

	// 2. 时间周期性加成 (Time of Day Bonus)
	// 计算当前时间与记忆时间在一天中的分钟数差异
	const memoryTime = memoryEntry.time_stamp
	const currentTime = currentTimeStamp
	const memoryMinutes = memoryTime.getHours() * 60 + memoryTime.getMinutes()
	const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes()
	const totalMinutesInDay = 24 * 60

	// 计算循环时间差（例如 23:00 和 01:00 差2小时而不是22小时）
	let timeOfDayDiff = Math.abs(memoryMinutes - currentMinutes)
	if (timeOfDayDiff > totalMinutesInDay / 2)
		timeOfDayDiff = totalMinutesInDay - timeOfDayDiff

	// 使用高斯函数（正态分布曲线）计算加成，差异越小加成越高
	const numerator = -(timeOfDayDiff * timeOfDayDiff)
	const denominator = 2 * TIME_OF_DAY_STD_DEV_MINUTES * TIME_OF_DAY_STD_DEV_MINUTES
	const timeOfDayBonus = TIME_OF_DAY_MAX_BONUS * Math.exp(numerator / denominator)
	relevanceScore += timeOfDayBonus

	// 3. 时间衰减惩罚 (Time Decay Penalty)
	// 记忆越久远，扣分越多（模拟遗忘），但有最大扣分上限
	const timeDiff = Math.max(0, currentTimeStamp.getTime() - (memoryEntry.time_stamp?.getTime() ?? 0))
	const timePenalty = MAX_TIME_PENALTY * (1 - Math.exp(-timeDiff * TIME_DECAY_FACTOR_EXP))
	relevanceScore -= timePenalty

	// 4. 加上记忆本身的固有分数（被引用过的记忆分数会更高）
	relevanceScore += memoryEntry.score

	return relevanceScore
}

/**
 * 清理旧的或不相关的记忆
 * 策略：保留最近一年的，按相关性排序，至少保留 MIN_RETAINED_MEMORIES 条
 * @param {Date} currentTimeStamp 当前时间戳
 */
function cleanupMemories(currentTimeStamp) {
	const initialMemoryCount = chat_memories.length
	const oneYearAgo = currentTimeStamp.getTime() - MEMORY_TTL_MS

	const passingMemories = []
	const failingMemories = []

	for (const mem of chat_memories) {
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
		chat_memories = passingMemories
	else {
		const neededFromFailing = MIN_RETAINED_MEMORIES - passingMemories.length
		failingMemories.sort((a, b) => b.relevance - a.relevance)
		const supplementaryMemories = failingMemories.slice(0, neededFromFailing)
		chat_memories = [...passingMemories, ...supplementaryMemories]
	}

	// 清理临时属性
	for (const mem of chat_memories) delete mem.relevance

	lastCleanupTime = currentTimeStamp.getTime()
	if (initialMemoryCount !== chat_memories.length)
		console.log(`[Memory] Cleanup ran. Removed ${initialMemoryCount - chat_memories.length} entries. Current size: ${chat_memories.length}`)
}

/**
 * 加权随机选择算法
 * 用于"随机回闪"功能，让分数高或较新的记忆更有可能被随机选中
 * @template T
 * @param {T[]} items - 待选择项数组
 * @param {number[]} weights - 对应各项的权重
 * @returns {T | null} - 选中的项
 */
function selectOneWeightedRandom(items, weights) {
	if (!items?.length || items.length !== weights.length)
		return null

	const totalWeight = weights.reduce((sum, w) => sum + Math.max(0, w), 0)
	// 权重总和无效时，退化为均匀随机
	if (totalWeight <= 0)
		if (items.length)
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

	return items[items.length - 1]
}

// ================= 主逻辑函数 =================

/**
 * 短期记忆处理主函数
 * 负责：提取当前对话关键词 -> 检索相关记忆 -> 生成Prompt -> 记录新记忆
 *
 * @param {chatReplyRequest_t} args 用户输入参数（包含聊天记录）
 * @param {logical_results_t} logical_results 逻辑结果
 * @returns {Promise<single_part_prompt_t>} 记忆组成的Prompt对象
 */
export async function ShortTermMemoryPrompt(args, logical_results) {
	const currentTimeStamp = new Date()
	const currentChatLog = args.chat_log
	const currentChatName = args.chat_name

	// 1. 处理当前对话：取最后5条记录提取关键词
	const recentLogSlice = currentChatLog.slice(-5)
	await Promise.all(recentLogSlice.map(PreprocessChatLogEntry))
	// 优化：使用提取的公共函数
	const currentKeywords = await extractKeywordsFromChatLog(
		flatChatLog(recentLogSlice),
		args.UserCharname,
		args.Charname
	)

	// 2. 记忆评分：计算所有记忆与当前对话的相关性
	/** @type {{memory: MemoryEntry, relevance: number, index: number}[]} */
	const scoredMemories = chat_memories
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
	let availableForRandomPool = chat_memories
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
		const memoryToUpdate = chat_memories[item.index]
		if (memoryToUpdate) memoryToUpdate.score = Math.min(memoryToUpdate.score + SCORE_INCREMENT_TOP, 100)
	})
	finalNextRelevant.forEach(item => {
		const memoryToUpdate = chat_memories[item.index]
		if (memoryToUpdate) memoryToUpdate.score = Math.min(memoryToUpdate.score + SCORE_INCREMENT_NEXT, 100)
	})

	// 5.5. 频道切换检查：如果上一次记忆的频道和当前不同，将最后一次记忆也加入 prompt
	if (lastSavedMemoryChatName && lastSavedMemoryChatName !== currentChatName && chat_memories.length > 0) {
		// 找到最后一次保存的记忆（属于上一次频道的最后一次记忆，按时间戳排序取最新的）
		const lastMemory = [...chat_memories]
			.filter(mem => mem.chat_name === lastSavedMemoryChatName)
			.sort((a, b) => b.time_stamp.getTime() - a.time_stamp.getTime())[0]

		if (lastMemory) {
			const lastMemoryIndex = chat_memories.indexOf(lastMemory)
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
			await match_keys(args, ['删了', '清除', '丢掉', '丢弃', '舍弃', '移除', '清空', '忘了', '忘掉'], 'user') &&
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

/**
 * 保存短期记忆到文件
 */
export function saveShortTermMemory() {
	cleanupMemories(new Date())
	fs.mkdirSync(path.join(chardir, 'memory'), { recursive: true })
	saveJsonFile(path.join(chardir, 'memory/short-term-memory.json'), chat_memories)
}

/**
 * 删除指定关键词的记忆
 * @param {string|RegExp} keyword - 要删除的记忆关键词或正则
 * @returns {number} - 删除的记忆数量
 */
export function deleteShortTermMemory(keyword) {
	const oldLength = chat_memories.length
	chat_memories = chat_memories.filter(mem => !(Object(keyword) instanceof RegExp ? keyword.test(mem.text) : mem.text.includes(keyword)))
	saveShortTermMemory()
	return oldLength - chat_memories.length
}

/**
 * @returns {number} - 短期记忆的数量
 */
export function getShortTermMemoryNum() {
	return chat_memories.length
}

/**
 * 在回复完成后保存短期记忆（包含回复结果）
 * @param {chatReplyRequest_t} args - 聊天回复请求参数（包含聊天记录）
 * @param {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReply_t} replyResult - 生成的回复结果
 */
export async function saveShortTermMemoryAfterReply(args, replyResult) {
	const currentTimeStamp = new Date()
	const currentChatLog = args.chat_log
	const currentChatName = args.chat_name

	// 构建包含回复结果的完整对话记录
	const memoryLogSlice = currentChatLog.slice(-10)

	// 只有非内部调用，且包含双方对话时才保存
	if (!args.extension?.is_internal &&
		memoryLogSlice.length &&
		memoryLogSlice.some(chatLogEntry => chatLogEntry.name == args.UserCharname) &&
		replyResult?.content
	) {
		const memoryLogWithReply = [...memoryLogSlice]
		if (replyResult.content)
			memoryLogWithReply.push({
				name: args.Charname,
				role: 'char',
				content: replyResult.content,
				time_stamp: currentTimeStamp,
				extension: {}
			})

		await Promise.all(memoryLogWithReply.map(PreprocessChatLogEntry))
		// 优化：使用提取的公共函数，减少重复代码
		const newMemoryKeywords = await extractKeywordsFromChatLog(
			flatChatLog(memoryLogWithReply),
			args.UserCharname,
			args.Charname
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
			chat_memories.push(newMemory)

			// 更新最后一次保存的记忆的频道名称
			lastSavedMemoryChatName = currentChatName
		}
		else
			console.warn('[Memory] Skipping saving new memory due to empty processed content.')

		// 5% 概率保存文件，减少 I/O
		if (Math.random() < 0.05) saveShortTermMemory()
	}
}
