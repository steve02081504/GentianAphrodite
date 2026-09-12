import { isCharSpeaker, isUserSpeaker } from '../../../scripts/match.mjs'
import jieba from '../jieba.mjs'

import { KEYWORD_MIN_WEIGHT } from './constants.mjs'


/** @typedef {import('../../../scripts/match.mjs').chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import('./constants.mjs').KeywordInfo} KeywordInfo */

/**
 * 从聊天日志中提取加权关键词（提取核心逻辑）。
 * @param {object[]} chat_log - 聊天记录数组
 * @param {chatReplyRequest_t} args - 请求（用于 uid / 显示名比对）
 * @returns {Promise<KeywordInfo[]>} - 关键词列表
 */
export async function extractKeywordsFromChatLog(chat_log, args) {
	const keywordMap = {}

	for (const entry of chat_log) {
		// 优先使用 SimplifiedContents (可能的预处理文本)，否则用 content
		const text = entry.extension?.SimplifiedContents?.[0] || entry.content
		if (!text?.trim()) continue

		// 权重加成：当前角色(User/Char)说的话权重更高
		let multiplier = 1.0
		if (isCharSpeaker(entry, args)) multiplier = 2.0
		else if (isUserSpeaker(entry, args)) multiplier = 2.7

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
