import { Buffer } from 'node:buffer'

import { setMyData } from '../config/index.mjs'
import { rude_words } from '../scripts/dict.mjs'
import { base_match_keys, base_match_keys_count, SimplifyChinese } from '../scripts/match.mjs'
import { newCharReply, newUserMessage } from '../scripts/statistics.mjs'
import { findMostFrequentElement } from '../scripts/tools.mjs'

import { sendAndLogReply, doMessageReply } from './reply.mjs'
import { channelLastSendMessageTime, channelMuteStartTimes, currentConfig, inHypnosisChannelId, fuyanMode, setFuyanMode, bannedStrings, channelChatLogs, GentianWords, waitForOwnerTypingToEnd, clearOwnerTypingStartTime } from './state.mjs'
import { fetchFilesForMessages, isBotCommand } from './utils.mjs'

/**
 * @readonly
 * @enum {symbol}
 */
const TriggerResultType = Object.freeze({
	TRIGGER_REPLY: Symbol('trigger_reply'),
	EXIT: Symbol('exit'),
	HANDLED: Symbol('handled'),
	NO_ACTION: Symbol('no_action'),
})

/**
 * 平台接口 API 对象类型定义。
 * @typedef {import('./index.mjs').PlatformAPI_t} PlatformAPI_t
 */

/**
 * 扩展的 fount 聊天日志条目类型，包含平台特定信息。
 * @typedef {import('./state.mjs').chatLogEntry_t_ext} chatLogEntry_t_ext
 */

/**
 * 检查传入的消息是否应该触发机器人回复。
 * @async
 * @param {chatLogEntry_t_ext} fountEntry - 当前正在处理的 fount 格式消息条目。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {string | number} channelId - 消息所在的频道 ID。
 * @param {{has_other_gentian_bot?: boolean}} [env={}] - 环境信息对象，例如是否检测到其他机器人。
 * @returns {Promise<boolean>} 如果应该回复则返回 true，否则返回 false。
 */
async function checkMessageTrigger(fountEntry, platformAPI, channelId, env = {}) {
	const content = (fountEntry.content || '').trim().replace(/^@\S+(?:\s+@\S+)*\s*/, '')
	const isFromOwner = fountEntry.extension?.is_from_owner === true

	if (fountEntry.extension?.is_direct_message)
		return isFromOwner || (channelChatLogs[channelId] || []).some(msg => msg.extension?.platform_user_id == platformAPI.getBotUserId())
	if (inHypnosisChannelId && inHypnosisChannelId === channelId && !isFromOwner) return false

	const { possibility, isMutedChannel, mentionedWithoutAt } = await calculateTriggerPossibility(fountEntry, platformAPI, channelId, content, env)

	if (isMutedChannel) return false // 检查在可能性计算期间频道是否被静音

	// 基于可能性分数做出最终决定
	const okey = Math.random() * 100 < possibility

	logTriggerCheckDetails(fountEntry, platformAPI, channelId, content, possibility, okey, isFromOwner, mentionedWithoutAt, env)

	return okey
}

/**
 * 根据关键词匹配计算分数。
 * @param {string} content - 消息内容。
 * @returns {number} 计算出的分数。
 */
function calculateKeywordBasedScore(content) {
	let score = 0
	const keywordMappings = [
		{ keywords: ['老婆', '女票', '女朋友', '炮友'], score: 50 },
		{ keywords: [/(有点|好)紧张/, '救救', '帮帮', /帮(我|(你|你家)?(主人|老公|丈夫|爸爸|宝宝))/, '来人', '咋用', '教教', /是真的(吗|么)/], score: 100 },
		{ keywords: ['睡了', '眠了', '晚安', '睡觉去了'], score: 50 },
		{ keywords: ['失眠了', '睡不着'], score: 100 },
		{ keywords: [/(?<!你)失眠(?!的)/, /(?<!别)(伤心|难受)/, '好疼'], score: 50 },
		{ keywords: ['早上好', '早安'], score: 100 }
	]

	for (const mapping of keywordMappings)
		if (base_match_keys(content, mapping.keywords))
			score += mapping.score

	if (base_match_keys(content, GentianWords) && base_match_keys(content, [/怎么(想|看)/]))
		score += 100

	return score
}

/**
 * 在互动偏好期内计算分数。
 * @param {string} content - 消息内容。
 * @param {PlatformAPI_t} platformAPI - 平台 API。
 * @param {string | number} channelId - 频道 ID。
 * @returns {number} 计算出的分数。
 */
function calculateInFavorScore(content, platformAPI, channelId) {
	let score = 4
	const botUserId = platformAPI.getBotUserId()
	const currentChannelLog = channelChatLogs[channelId] || []
	const lastBotMsgIndex = currentChannelLog.findLastIndex(log => log.extension?.platform_user_id == botUserId)
	const messagesSinceLastBotReply = lastBotMsgIndex === -1 ? currentChannelLog.length : currentChannelLog.slice(lastBotMsgIndex + 1).length
	if (base_match_keys(content, [
		/(再|多|重)(来|表演)(点|.*(次|个))/, '来个', '不够', '不如', '继续', '确认', '执行',
		/^(重来|那|所以你|可以再|你?再(讲|说|试试|猜|来)|你(觉得|想|知道|确定|试试)|但是|我?是说)/, /^so/i,
	]) && messagesSinceLastBotReply <= 3)
		score += 100

	return score
}

/**
 * 为来自主人的消息计算触发可能性的增量。
 * @async
 * @param {chatLogEntry_t_ext} fountEntry - 当前消息条目。
 * @param {string} content - 清理后的消息内容。
 * @param {PlatformAPI_t} platformAPI - 平台 API。
 * @param {string | number} channelId - 频道 ID。
 * @param {number} possible - 当前的可能性分数。
 * @param {boolean} isInFavor - 是否处于互动偏好期。
 * @param {boolean} mentionedWithoutAt - 是否在没有@的情况下提及了机器人。
 * @returns {Promise<{ newPossible: number, isMutedUpdate: boolean }>} 返回更新后的可能性分数和静音状态是否被更新。
 */
async function calculateOwnerTriggerIncrement(fountEntry, content, platformAPI, channelId, possible, isInFavor, mentionedWithoutAt) {
	let isMutedChannelUpdate = false // 跟踪此函数是否静音了频道的局部变量
	if (mentionedWithoutAt || fountEntry.extension?.mentions_bot) {
		possible += 100
		delete channelMuteStartTimes[channelId] // 取消频道静音
	}
	if (isInFavor && base_match_keys(content, ['闭嘴', '安静', '肃静']) && content.length < 10) {
		channelMuteStartTimes[channelId] = Date.now() // 静音频道
		isMutedChannelUpdate = true // 标记此函数静音了频道
		return { newPossible: 0, isMutedUpdate: isMutedChannelUpdate } // 如果主人静音则提前退出
	}

	possible += calculateKeywordBasedScore(content)

	if (isInFavor)
		possible += calculateInFavorScore(content, platformAPI, channelId)

	if (!isBotCommand(content))
		possible += currentConfig.BaseTriggerChanceToOwner

	return { newPossible: possible, isMutedUpdate: isMutedChannelUpdate }
}

/**
 * 为非主人的消息计算触发可能性的增量。
 * @async
 * @param {chatLogEntry_t_ext} fountEntry - 当前消息条目。
 * @param {string} content - 清理后的消息内容。
 * @param {PlatformAPI_t} platformAPI - 平台 API。
 * @param {number} possible - 当前的可能性分数。
 * @param {boolean} isInFavor - 是否处于互动偏好期。
 * @param {boolean} mentionedWithoutAt - 是否在没有@的情况下提及了机器人。
 * @returns {Promise<{ newPossible: number, fuyanExit: boolean }>} 返回更新后的可能性分数和是否应因敷衍模式退出。
 */
async function calculateNonOwnerTriggerIncrement(fountEntry, content, platformAPI, possible, isInFavor, mentionedWithoutAt) {
	if (mentionedWithoutAt) {
		if (isInFavor) possible += 90
		else possible += 40
		if (base_match_keys(content, [/[午安早晚]安/])) possible += 100
	}
	else if (fountEntry.extension?.mentions_bot) {
		possible += 40
		if (base_match_keys(content, [/\?|？/, '怎么', '什么', '吗', /(大|小)还是/, /(还是|哪个)(大|小)/])) possible += 100
		if (base_match_keys(content, rude_words))
			if (fuyanMode) return { newPossible: 0, fuyanExit: true }
			else possible += 100

		if (base_match_keys(content, ['你主人', '你的主人'])) possible += 100
	}
	return { newPossible: possible, fuyanExit: false }
}

/**
 * 计算消息触发的可能性分数。
 * @async
 * @param {chatLogEntry_t_ext} fountEntry - 当前消息条目。
 * @param {PlatformAPI_t} platformAPI - 平台 API。
 * @param {string | number} channelId - 频道 ID。
 * @param {string} content - 清理后的消息内容。
 * @param {{has_other_gentian_bot?: boolean}} [env={}] - 环境信息。
 * @returns {Promise<{possibility: number, isMutedChannel: boolean, mentionedWithoutAt: boolean}>} 返回包含可能性、静音状态和提及方式的对象。
 */
async function calculateTriggerPossibility(fountEntry, platformAPI, channelId, content, env = {}) {
	let possible = 0
	const isFromOwner = fountEntry.extension?.is_from_owner === true

	const firstFiveChars = content.substring(0, 5)
	const lastFiveChars = content.substring(content.length - 5)
	const contentEdgesForChineseCheck = firstFiveChars + ' ' + lastFiveChars

	const engWords = content.split(' ')
	const leadingEngWords = engWords.slice(0, 6).join(' ')
	const trailingEngWords = engWords.slice(-3).join(' ')
	const contentEdgesForEnglishCheck = leadingEngWords + ' ' + trailingEngWords

	const isChineseNamePattern = base_match_keys(contentEdgesForChineseCheck, ['龙胆', /(?<![乌肝巨火大苦])[龙胆][子宝儿亲 ]/])
	const isEnglishNamePattern = base_match_keys(contentEdgesForEnglishCheck, ['gentian'])
	const isBotNamePatternDetected = isChineseNamePattern || isEnglishNamePattern

	// Check for phrases that negate a direct mention (e.g., "龙胆的", "gentian's")
	const isPossessiveOrStatePhrase = base_match_keys(content, [
		/(龙胆(有(?!没有)|能|这边|目前|[^ 。你，]{0,3}的)|(gentian('s|is|are|can|has)))/i
	])
	// Check if the bot's name is at the very end of a short sentence, which might not be a direct mention.
	const isNameAtEndOfShortPhrase = base_match_keys(content, [/^.{0,4}龙胆$/i])

	const mentionedWithoutAt = !env.has_other_gentian_bot &&
		isBotNamePatternDetected &&
		!isPossessiveOrStatePhrase &&
		!isNameAtEndOfShortPhrase

	possible += base_match_keys(content, fountEntry.extension.OwnerNameKeywords || []) * 7
	possible += base_match_keys(content, GentianWords) * 5
	possible += base_match_keys(content, [/(花|华)(萝|箩|罗)(蘑|磨|摩)/g]) * 3

	const timeSinceLastBotMessageInChannel = fountEntry.time_stamp - (channelLastSendMessageTime[channelId] || 0)
	const isInFavor = timeSinceLastBotMessageInChannel < currentConfig.InteractionFavorPeriodMs
	let isMutedChannel = (Date.now() - (channelMuteStartTimes[channelId] || 0)) < currentConfig.MuteDurationMs

	if (isFromOwner) {
		const ownerResult = await calculateOwnerTriggerIncrement(fountEntry, content, platformAPI, channelId, possible, isInFavor, mentionedWithoutAt)
		possible = ownerResult.newPossible
		if (ownerResult.isMutedUpdate)  // 如果主人静音了频道
			return { possibility: 0, isMutedChannel: true, mentionedWithoutAt }

		// 如果主人取消了静音，isMutedChannel 可能已变为 false，若未被主人明确静音，则根据全局状态重新评估
		isMutedChannel = (Date.now() - (channelMuteStartTimes[channelId] || 0)) < currentConfig.MuteDurationMs
	}
	else { // 非主人消息
		const nonOwnerResult = await calculateNonOwnerTriggerIncrement(fountEntry, content, platformAPI, possible, isInFavor, mentionedWithoutAt)
		possible = nonOwnerResult.newPossible
		if (nonOwnerResult.fuyanExit)  // 如果处于敷衍模式且遇到粗鲁言辞
			return { possibility: 0, isMutedChannel, mentionedWithoutAt }
	}

	if (fountEntry.extension?.mentions_owner || base_match_keys(content, fountEntry.extension.OwnerNameKeywords)) {
		possible += 7
		if (base_match_keys(content, rude_words))
			if (fuyanMode) return { possibility: 0, isMutedChannel, mentionedWithoutAt }
		// 如果不在敷衍模式且对主人说粗话，则隐含高触发率

	}
	return { possibility: possible, isMutedChannel, mentionedWithoutAt }
}

/**
 * 记录触发检查的详细信息。
 * @param {chatLogEntry_t_ext} fountEntry - 消息条目。
 * @param {PlatformAPI_t} platformAPI - 平台 API。
 * @param {string | number} channelId - 频道 ID。
 * @param {string} content - 清理后的消息内容。
 * @param {number} possible - 计算出的可能性分数。
 * @param {boolean} okey - 是否触发。
 * @param {boolean} isFromOwner - 是否来自主人。
 * @param {boolean} mentionedWithoutAt - 是否在没有@的情况下提及。
 * @param {{has_other_gentian_bot?: boolean}} [env={}] - 环境信息。
 */
function logTriggerCheckDetails(fountEntry, platformAPI, channelId, content, possible, okey, isFromOwner, mentionedWithoutAt, env = {}) {
	const timeSinceLastBotMessageInChannel = fountEntry.time_stamp - (channelLastSendMessageTime[channelId] || 0)
	const isInFavor = timeSinceLastBotMessageInChannel < currentConfig.InteractionFavorPeriodMs
	console.dir({
		chat_name: platformAPI.getChatNameForAI(channelId, fountEntry),
		name: fountEntry.name,
		content,
		files: fountEntry.files.length,
		channelId,
		possible,
		okey,
		isFromOwner,
		isInFavor,
		mentionsBot: fountEntry.extension?.mentions_bot,
		mentionsOwner: fountEntry.extension?.mentions_owner,
		mentionedWithoutAt,
		hasOtherGentianBot: env.has_other_gentian_bot,
	}, { depth: null })
}

/**
 * 检查消息是否可以合并到上一条消息。
 * @param {chatLogEntry_t_ext | null} lastLogEntry - 上一条日志条目。
 * @param {chatLogEntry_t_ext | null} currentMessageToProcess - 当前待处理的消息。
 * @returns {boolean} 如果可以合并则返回 true。
 */
function isMessageMergeable(lastLogEntry, currentMessageToProcess) {
	return lastLogEntry && currentMessageToProcess &&
		lastLogEntry.name === currentMessageToProcess.name &&
		currentMessageToProcess.time_stamp - lastLogEntry.time_stamp < currentConfig.MergeMessagePeriodMs &&
		!lastLogEntry.files?.length &&
		!lastLogEntry.logContextAfter?.length &&
		lastLogEntry.extension?.platform_message_ids &&
		currentMessageToProcess.extension?.platform_message_ids
}

/**
 * 将当前消息合并到上一条日志条目中。
 * @param {chatLogEntry_t_ext} lastLogEntry - 上一条日志条目。
 * @param {chatLogEntry_t_ext} currentMessage - 当前待合并的消息。
 */
function mergeMessageIntoLastEntry(lastLogEntry, currentMessage) {
	const lastContentParts = lastLogEntry.extension?.content_parts || [lastLogEntry.content]
	const currentContentParts = currentMessage.extension?.content_parts || [currentMessage.content]

	lastLogEntry.content = lastContentParts.concat(currentContentParts).join('\n')
	lastLogEntry.files = currentMessage.files
	lastLogEntry.time_stamp = currentMessage.time_stamp
	lastLogEntry.extension = {
		...lastLogEntry.extension,
		...currentMessage.extension,
		platform_message_ids: Array.from(new Set([
			...lastLogEntry.extension?.platform_message_ids || [],
			...currentMessage.extension?.platform_message_ids || []
		])),
		content_parts: lastContentParts.concat(currentContentParts),
		SimplifiedContents: undefined,
	}
}

/**
 * 在消息队列中处理主人的命令。
 * @async
 * @param {chatLogEntry_t_ext} currentMessageToProcess - 当前正在处理的消息。
 * @param {PlatformAPI_t} platformAPI - 平台 API。
 * @param {string | number} channelId - 频道 ID。
 * @returns {Promise<TriggerResultType>} 返回一个操作类型。
 */
async function handleOwnerCommandsInQueue(currentMessageToProcess, platformAPI, channelId) {
	if (currentMessageToProcess.extension?.is_from_owner) {
		const { content } = currentMessageToProcess
		if (!inHypnosisChannelId || channelId === inHypnosisChannelId) {
			if (base_match_keys(content, [/^龙胆.{0,2}敷衍点.{0,2}$/])) setFuyanMode(true)
			if (base_match_keys(content, [/^龙胆.{0,2}不敷衍点.{0,2}$/])) setFuyanMode(false)
			if (base_match_keys(content, [/^龙胆.{0,2}(捂住耳朵|关上耳朵|[关闭]耳|别听|关闭听觉|中断听觉).{0,2}$/])) {
				await setMyData({ reality_channel_disables: { voice_sentinel: true } })
				const replyContent = inHypnosisChannelId === channelId ? '听觉已关闭。' : '唔...听不见了。'
				await sendAndLogReply({ content: replyContent }, platformAPI, channelId, currentMessageToProcess)
				newUserMessage(content, platformAPI.name)
				newCharReply(replyContent, platformAPI.name)
				return TriggerResultType.HANDLED
			}
			if (base_match_keys(content, [/^龙胆.{0,2}(可以听了|张开耳朵|开耳|开启听觉|恢复听觉).{0,2}$/])) {
				await setMyData({ reality_channel_disables: { voice_sentinel: false } })
				const replyContent = inHypnosisChannelId === channelId ? '听觉已开启。' : '嗯！又能听见主人的声音了！'
				await sendAndLogReply({ content: replyContent }, platformAPI, channelId, currentMessageToProcess)
				newUserMessage(content, platformAPI.name)
				newCharReply(replyContent, platformAPI.name)
				return TriggerResultType.HANDLED
			}
			if (base_match_keys(content, [/^龙胆.{0,2}自裁.{0,2}$/])) {
				const selfDestructReply = inHypnosisChannelId === channelId ? { content: '好的。' } : { content: '啊，咱死了～' }
				await sendAndLogReply(selfDestructReply, platformAPI, channelId, currentMessageToProcess)
				newUserMessage(content, platformAPI.name)
				newCharReply(selfDestructReply.content, platformAPI.name)
				await platformAPI.destroySelf()
				return TriggerResultType.EXIT // 发出退出信号
			}
			const repeatMatch = content.match(/^龙胆.{0,2}复诵.{0,2}[\n\s]*(?<backticks>`+)[^\n]*\n(?<repeat_content>[\s\S]*?)\k<backticks>[\n\s]*$/)
			if (repeatMatch?.groups?.repeat_content) {
				await sendAndLogReply({ content: repeatMatch.groups.repeat_content }, platformAPI, channelId, currentMessageToProcess)
				newUserMessage(content, platformAPI.name)
				newCharReply(repeatMatch.groups.repeat_content, platformAPI.name)
				return TriggerResultType.HANDLED // 命令已处理，无需进一步触发检查
			}
			const banWordMatch = content.match(/^龙胆.{0,2}禁止.{0,2}`(?<banned_content>[\S\s]*)`$/)
			if (banWordMatch?.groups?.banned_content)
				bannedStrings.push(banWordMatch.groups.banned_content)

			if (base_match_keys(content, [/^[\n,.~、。呵哦啊嗯噫欸胆龙子宝儿亲，～]+$/, /^[\n,.~、。呵哦啊嗯噫欸胆龙子宝儿亲，～]{4}[\n!,.?~、。呵哦啊嗯噫欸胆龙子宝儿亲！，？～]+$/])) {
				const ownerCallReply = SimplifyChinese(content).replaceAll('龙', '主').replaceAll('胆', '人')
				await sendAndLogReply({ content: ownerCallReply }, platformAPI, channelId, currentMessageToProcess)
				newUserMessage(content, platformAPI.name)
				newCharReply(ownerCallReply, platformAPI.name)
				return TriggerResultType.HANDLED // 命令已处理
			}
		}
	}
	return TriggerResultType.NO_ACTION // 没有处理主人命令或消息非来自主人
}

/**
 * 在消息队列处理中检查单个消息是否应触发回复或特殊操作。
 * @async
 * @param {chatLogEntry_t_ext} currentMessageToProcess - 当前正在处理的消息条目。
 * @param {chatLogEntry_t_ext[]} currentChannelLog - 当前频道的完整聊天记录。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {string | number} channelId - 消息所在的频道 ID。
 * @returns {Promise<TriggerResultType>} 返回一个对象，指示应执行的操作类型。
 */
async function checkQueueMessageTrigger(currentMessageToProcess, currentChannelLog, platformAPI, channelId) {
	if (currentMessageToProcess.extension?.platform_user_id == platformAPI.getBotUserId())
		return TriggerResultType.NO_ACTION // 不处理机器人自己的消息触发

	const ownerCommandResult = await handleOwnerCommandsInQueue(currentMessageToProcess, platformAPI, channelId)
	if (ownerCommandResult !== TriggerResultType.NO_ACTION)
		return ownerCommandResult

	const recentChatLogForOtherBotCheck = currentChannelLog.filter(msg => (Date.now() - msg.time_stamp) < 5 * 60 * 1000)
	const hasOtherGentianBot = (() => {
		const text = recentChatLogForOtherBotCheck
			.filter(msg => msg.extension?.platform_user_id != platformAPI.getBotUserId())
			.map(msg => msg.content).join('\n')
		return base_match_keys_count(text, GentianWords) && base_match_keys_count(text, ['主人', 'master']) > 1
	})()

	const isMutedChannel = (Date.now() - (channelMuteStartTimes[channelId] || 0)) < currentConfig.MuteDurationMs

	const ownerBotOnlyInteraction = currentChannelLog.slice(-7).every(
		msg => msg.extension?.is_from_owner || msg.extension?.platform_user_id == platformAPI.getBotUserId()
	)

	if (await checkMessageTrigger(currentMessageToProcess, platformAPI, channelId, { has_other_gentian_bot: hasOtherGentianBot }))
		return TriggerResultType.TRIGGER_REPLY // 应该触发回复
	else if (ownerBotOnlyInteraction && currentMessageToProcess.extension?.is_from_owner && !isMutedChannel)
		return TriggerResultType.TRIGGER_REPLY // 如果是主人在仅有主人和机器人的对话中发言，则触发
	else if (
		(!inHypnosisChannelId || channelId !== inHypnosisChannelId) &&
		!isMutedChannel &&
		currentMessageToProcess.extension?.platform_user_id != platformAPI.getBotUserId()
	) {
		// 复读检查
		const repeatCheckLog = currentChannelLog.slice(-10)
		const nameMap = {}
		/**
		 * 辅助函数，用于生成文件列表的摘要字符串。
		 * @param {any[]} files - 文件数组。
		 * @returns {string} 文件摘要字符串。
		 */
		let summaryFiles = files => files.length
		/**
		 * 辅助函数，用于生成消息的摘要字符串，用于重复消息检测。
		 * @param {chatLogEntry_t_ext} message - 消息条目。
		 * @param {boolean} [name_diff=true] - 是否在摘要中包含名称差异信息。
		 * @returns {string} 消息的摘要字符串。
		 */
		function summary(message, name_diff = true) {
			let result = ''
			if (name_diff) {
				nameMap[message.name] ??= 0
				result += nameMap[message.name]++ + '\n'
			}
			result += (message.content ?? '') + '\n\n'
			result += summaryFiles(message.files || [])
			return result
		}
		let repeat = findMostFrequentElement(repeatCheckLog, summary)
		// 先进行粗略检测决定是否fetch
		if (
			(repeat.element?.content || repeat.element?.files?.length) &&
			repeat.count >= currentConfig.RepetitionTriggerCount &&
			!base_match_keys(repeat.element.content, [...currentMessageToProcess.extension.OwnerNameKeywords || [], ...rude_words, ...GentianWords]) &&
			!isBotCommand(repeat.element.content)
		) {
			// 通过，fetch后重新计算复读内容
			await fetchFilesForMessages(repeatCheckLog)
			/**
			 * 重新定义 summaryFiles，用于在获取文件内容后生成更详细的摘要。
			 * @param {any[]} files - 文件数组。
			 * @returns {string} 文件摘要字符串。
			 */
			summaryFiles = files => files.filter(file => !file.extension?.is_from_vision).map(file => file.buffer instanceof Buffer ? file.buffer.toString('hex') : String(file.buffer)).join('\n')
			repeat = findMostFrequentElement(repeatCheckLog, summary)
			if (
				(repeat.element?.content || repeat.element?.files?.length) &&
				repeat.count >= currentConfig.RepetitionTriggerCount &&
				!base_match_keys(repeat.element.content + '\n' + (repeat.element.files || []).map(file => file.name).join('\n'), [...currentMessageToProcess.extension.OwnerNameKeywords || [], ...rude_words, ...GentianWords]) &&
				!isBotCommand(repeat.element.content) &&
				!repeatCheckLog.some(msg => msg.extension?.platform_user_id == platformAPI.getBotUserId() && summary(msg, false) === summary(repeat.element, false))
			) {
				await sendAndLogReply(
					{ content: repeat.element.content, files: repeat.element.files.filter(file => !file.extension?.is_from_vision) },
					platformAPI, channelId, currentMessageToProcess
				)
				// 复读已发送，此消息不再触发通用回复
				return TriggerResultType.HANDLED // 返回 'handled'，因为复读是一种回复，但不是需要新 AI 响应的“触发”
			}
		}
	}
	return TriggerResultType.NO_ACTION // 此函数无特定触发操作
}

/**
 * 处理消息队列中的下一条消息（包括合并和触发检查）。
 * @async
 * @param {chatLogEntry_t_ext[]} myQueue - 当前频道的消息队列。
 * @param {chatLogEntry_t_ext[]} currentChannelLog - 当前频道的聊天记录。
 * @param {PlatformAPI_t} platformAPI - 平台 API。
 * @param {string | number} channelId - 频道 ID。
 * @returns {Promise<number>} 如果需要退出处理则返回1。
 */
export async function processNextMessageInQueue(myQueue, currentChannelLog, platformAPI, channelId) {
	let currentMessageToProcess = myQueue[0]
	if (!currentMessageToProcess) {
		myQueue.shift()
		return
	}

	const lastLogEntry = currentChannelLog.length ? currentChannelLog[currentChannelLog.length - 1] : null
	let triggered = false

	if (!isMessageMergeable(lastLogEntry, currentMessageToProcess)) {
		currentChannelLog.push(currentMessageToProcess)
		myQueue.shift()
		const triggerResult = await checkQueueMessageTrigger(currentMessageToProcess, currentChannelLog, platformAPI, channelId)
		if (triggerResult === TriggerResultType.EXIT) return 1
		if (triggerResult === TriggerResultType.TRIGGER_REPLY) triggered = true
	}
	else {
		const actualLastLogEntry = lastLogEntry
		do {
			const triggerResultForCurrent = await checkQueueMessageTrigger(currentMessageToProcess, currentChannelLog, platformAPI, channelId)
			mergeMessageIntoLastEntry(actualLastLogEntry, currentMessageToProcess)
			myQueue.shift()

			if (triggerResultForCurrent === TriggerResultType.EXIT) return 1
			if (triggerResultForCurrent === TriggerResultType.TRIGGER_REPLY) triggered = true

			currentMessageToProcess = myQueue[0]
		} while (isMessageMergeable(actualLastLogEntry, currentMessageToProcess))
	}

	while (currentChannelLog.length > currentConfig.DefaultMaxMessageDepth)
		currentChannelLog.shift()

	if (!triggered) return

	const messageForReply = currentChannelLog[currentChannelLog.length - 1]
	if (messageForReply.extension?.is_from_owner) {
		await waitForOwnerTypingToEnd(channelId)
		while (isMessageMergeable(messageForReply, myQueue[0])) {
			mergeMessageIntoLastEntry(messageForReply, myQueue[0])
			myQueue.shift()
		}
		clearOwnerTypingStartTime(channelId)
	}

	await doMessageReply(messageForReply, platformAPI, channelId)
}
