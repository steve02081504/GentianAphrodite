import {
	MAX_TIME_PENALTY,
	TIME_DECAY_FACTOR_EXP,
	TIME_OF_DAY_MAX_BONUS,
	TIME_OF_DAY_STD_DEV_MINUTES,
} from './constants.mjs'

/** @typedef {import('./constants.mjs').KeywordInfo} KeywordInfo */
/** @typedef {import('./constants.mjs').MemoryEntry} MemoryEntry */

/**
 * 计算单个记忆条目的相关性分数。
 * 核心算法包含三个部分：关键词匹配度 + 时间周期性匹配 + 时间衰减。
 *
 * @param {MemoryEntry} memoryEntry - 历史记忆条目
 * @param {KeywordInfo[]} currentKeywords - 当前对话上下文提取的关键词
 * @param {Date} currentTimeStamp - 当前时间戳
 * @returns {number} - 综合相关性分数
 */
export function calculateRelevance(memoryEntry, currentKeywords, currentTimeStamp) {
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
 * 加权随机选择算法。
 * 用于"随机回闪"功能，让分数高或较新的记忆更有可能被随机选中。
 * @template T
 * @param {T[]} items - 待选择项数组
 * @param {number[]} weights - 对应各项的权重
 * @returns {T | null} - 选中的项
 */
export function selectOneWeightedRandom(items, weights) {
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
