import Tokenizer from 'npm:mistral-tokenizer-js'

import { resetIdleTimer } from '../event_engine/on_idle.mjs'

import { parseDuration } from './tools.mjs'
import { getVar, saveVar } from './vars.mjs'

/**
 * 使用 mistral-tokenizer-js 对 prompt 进行分词。
 * @param {string} prompt - 要分词的 prompt。
 * @returns {number[]} - 返回分词后的 token ID 数组。
 */
function tokenize(prompt) {
	return Tokenizer.encode(prompt)
}

/**
 * 统计数据。
 * @type {object}
 */
export const statisticDatas = getVar('statistics', {
	firstInteraction: {
		time: undefined,
		userMessageContent: undefined,
		characterReplyContent: undefined,
		chat_name: undefined,
	},

	userActivity: {
		totalMessagesSent: 0,
		totalStatementsSent: 0,
		NsfwMessagesSent: 0,
		InHypnosisMessagesSent: 0,
		byPlatform: {
			discord: {
				messagesSent: 0,
				statementsSent: 0,
			},
			telegram: {
				messagesSent: 0,
				statementsSent: 0,
			},
			shell: {
				messagesSent: 0,
				statementsSent: 0,
			},
		}
	},

	characterActivity: {
		totalMessagesSent: 0,
		totalStatementsSent: 0,
		byPlatform: {
			discord: {
				messagesSent: 0,
				statementsSent: 0,
			},
			telegram: {
				messagesSent: 0,
				statementsSent: 0,
			},
			shell: {
				messagesSent: 0,
				statementsSent: 0,
			},
		}
	},

	toolUsage: {
		codeRuns: 0,
		deepResearchSessions: 0,
		fileOperations: 0,
		googleSearches: 0,
		webBrowses: 0,
		timersSet: 0,
		timerCallbacks: 0,
		browserOperations: 0,
		browserCallbacks: 0,
	},

	longestDailyChat: {
		start: 0,
		end: 0,
	},
	trackingDailyChat: {
		start: 0,
		end: 0,
	},

	avgTokenNum: 7400,
})

/**
 * 记录一条新的用户消息以进行统计。
 * @param {string} str - 用户的消息内容。
 * @param {string} platform - 消息来源的平台。
 */
export function newUserMessage(str, platform) {
	resetIdleTimer()
	const sentenceNum = getStatementsNum(str)
	statisticDatas.userActivity.totalMessagesSent++
	statisticDatas.userActivity.totalStatementsSent += sentenceNum
	statisticDatas.userActivity.byPlatform[platform] ??= {
		messagesSent: 0,
		statementsSent: 0,
	}
	statisticDatas.userActivity.byPlatform[platform].messagesSent++
	statisticDatas.userActivity.byPlatform[platform].statementsSent += sentenceNum
}
const the25h = parseDuration('25h')
/**
 * 记录一条新的角色回复以进行统计。
 * @param {string} str - 角色的回复内容。
 * @param {string} platform - 回复发送到的平台。
 */
export function newCharReplay(str, platform) {
	const sentenceNum = getStatementsNum(str)
	statisticDatas.characterActivity.totalMessagesSent++
	statisticDatas.characterActivity.totalStatementsSent += sentenceNum
	statisticDatas.characterActivity.byPlatform[platform] ??= {
		messagesSent: 0,
		statementsSent: 0,
	}
	statisticDatas.characterActivity.byPlatform[platform].messagesSent++
	statisticDatas.characterActivity.byPlatform[platform].statementsSent += sentenceNum
	const now = Date.now()
	statisticDatas.longestDailyChat.start ||= now
	statisticDatas.longestDailyChat.end ||= now
	statisticDatas.trackingDailyChat.start ||= now
	statisticDatas.trackingDailyChat.end = now
	if (
		statisticDatas.trackingDailyChat.end - statisticDatas.trackingDailyChat.start
		>
		statisticDatas.longestDailyChat.end - statisticDatas.longestDailyChat.start
	)
		statisticDatas.longestDailyChat = statisticDatas.trackingDailyChat
	if (now - statisticDatas.trackingDailyChat.end > the25h)
		statisticDatas.trackingDailyChat = {
			start: now,
			end: 0
		}
}

/**
 * 返回给定字符串中的语句数。
 * 语句是以!、.、?、或,结尾的句子。
 * 该函数还会删除任何代码块（三反引号之间的文本）。
 * @param {string} str - 要计算语句数的字符串。
 * @returns {number} - 语句数。
 */
export function getStatementsNum(str) {
	str = str.replace(/```+.*\n[^]*?```+/g, '')
	return str.match(/[^\n!.?。《》！？]+/g)?.length || 0
}

/**
 * 更新 prompt token 数据的统计信息。
 * @param {object} prompt - 要分析的 prompt 对象。
 */
export function updatePromptTokenData(prompt) {
	let prompt_str = ''
	prompt_str += prompt.text.sort((a, b) => a.important - b.important).map(x => x.content).join('\n')
	prompt_str += prompt.additional_chat_log.map(x => x.name + ': ' + x.content).join('\n\n')
	const tokenSize = tokenize(prompt_str).length
	statisticDatas.avgTokenNum = (statisticDatas.avgTokenNum * 12 + tokenSize) / 13
	console.log('token size', tokenSize)
	console.log('avg token size', statisticDatas.avgTokenNum)
	if (Math.random() < 0.1) saveStatisticDatas()
	return
}

/**
 * 保存统计数据。
 */
export function saveStatisticDatas() {
	saveVar('statistics')
}
