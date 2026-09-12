import {
	fetchFilesForMessages,
	isBotCommand,
	rowAuthorHash,
	rowTextContent,
	rowIsFromSelf,
	summaryFilesHex,
} from '../scripts/chat-log.mjs'
import { rude_words } from '../scripts/dict.mjs'
import { base_match_keys } from '../scripts/match.mjs'
import { newCharReply, newUserMessage } from '../scripts/statistics.mjs'
import { findMostFrequentElement } from '../scripts/tools/index.mjs'

import { GentianWords, RepetitionTriggerCount, RepeatBlacklist } from './constants.mjs'
import { extractMessageText, isGroupMuted } from './helpers.mjs'

/**
 * @param {object} params 参数
 * @param {object} params.event OnMessage 事件
 * @param {object} params.message Message 对象
 * @param {object} params.memory chat_scoped_char_memory
 * @param {string} params.platform 平台名
 * @param {string} params.selfHash 自身 hash
 * @param {Array<string | RegExp>} [params.ownerNameKeywords] 主人称呼关键词
 * @returns {Promise<boolean>} 是否已就地回复
 */
export async function tryRepeatReply({
	event, message, memory, platform, selfHash, ownerNameKeywords = [],
}) {
	const {groupId} = event.group
	if (isGroupMuted(memory, groupId)) return false

	const repeatCheckLog = (event.chatReplyRequest.chat_log || []).slice(-10)
	/** @type {Record<string, number>} */
	let nameMap = {}
	/**
	 * @param {object[]} files 文件列表
	 * @returns {string} 文件摘要
	 */
	let summaryFiles = files => String((files || []).length)
	/**
	 * @param {object} row chat_log 行
	 * @param {boolean} [nameDiff=true] 是否区分发言人
	 * @returns {string} 复读判定摘要
	 */
	function summary(row, nameDiff = true) {
		let result = ''
		if (nameDiff) {
			const key = rowAuthorHash(row)
			nameMap[key] ??= 0
			result += nameMap[key]++ + '\n'
		}
		result += rowTextContent(row) + '\n\n'
		result += summaryFiles(row.files || [])
		return result
	}

	let repeat = findMostFrequentElement(repeatCheckLog, summary)
	const repeatContent = rowTextContent(repeat.element)
	if (
		!(repeatContent || repeat.element?.files?.length) ||
		repeat.count < RepetitionTriggerCount ||
		base_match_keys(repeatContent, [...ownerNameKeywords, ...rude_words, ...GentianWords, ...RepeatBlacklist]) ||
		isBotCommand(repeatContent)
	) return false

	await fetchFilesForMessages(repeatCheckLog)
	summaryFiles = summaryFilesHex
	nameMap = {}
	repeat = findMostFrequentElement(repeatCheckLog, summary)
	const refinedContent = rowTextContent(repeat.element)
	if (
		!(refinedContent || repeat.element?.files?.length) ||
		repeat.count < RepetitionTriggerCount ||
		base_match_keys(
			refinedContent + '\n' + (repeat.element.files || []).map(file => file.name).join('\n'),
			[...ownerNameKeywords, ...rude_words, ...GentianWords, ...RepeatBlacklist],
		) ||
		isBotCommand(refinedContent) ||
		repeatCheckLog.some(row =>
			rowIsFromSelf(row, selfHash) && summary(row, false) === summary(repeat.element, false),
		)
	) return false

	const files = (repeat.element.files || []).filter(file => !file.extension?.is_from_vision)
	await message.reply({ content: refinedContent, files })
	newUserMessage(extractMessageText(event.message), platform)
	newCharReply(refinedContent, platform)
	return true
}
