import { parseDuration } from './tools.mjs'
import { getVar, saveVar } from './vars.mjs'
import llama3Tokenizer from 'npm:llama3-tokenizer-js'

function tokenize(prompt) {
	return llama3Tokenizer.encode(prompt)
}

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

if (statisticDatas.toolUsage.detailedThinkingSessions)
	statisticDatas.toolUsage.deepResearchSessions = statisticDatas.toolUsage.detailedThinkingSessions
delete statisticDatas.toolUsage.detailedThinkingSessions

export function newUserMessage(str, platform) {
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
 * Return the number of statements in the given string.
 * A statement is a sentence ending with !, ., ?, ?, or ,.
 * The function also removes any block of code (text between triple backticks)
 * @param {string} str
 * @returns {number}
 */
export function getStatementsNum(str) {
	str = str.replace(/```+.*\n[^]*?```+/g, '')
	return str.match(/[^\n!.?。《》！？]+/g)?.length || 0
}

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

export function saveStatisticDatas() {
	saveVar('statistics')
}
