import { Buffer } from 'node:buffer'
import { charname as BotCharname, username as FountUsername } from '../charbase.mjs'
import GentianAphrodite from '../main.mjs'

import { base_match_keys, base_match_keys_count, SimplifyChinese } from '../scripts/match.mjs'
import { findMostFrequentElement } from '../scripts/tools.mjs'
import { rude_words } from '../scripts/dict.mjs'
import { localhostLocales } from '../../../../../../src/scripts/i18n.mjs'
import { newCharReplay, newUserMessage } from '../scripts/statistics.mjs'
import { reloadPart } from '../../../../../../src/server/managers/index.mjs'

/**
 * Fount 基础聊天日志条目类型。
 * @typedef {import('../../../../../src/public/shells/chat/decl/chatLog.ts').chatLogEntry_t} FountChatLogEntryBase
 */

/**
 * Fount 聊天回复对象类型。
 * @typedef {import('../../../../../src/public/shells/chat/decl/chatLog.ts').chatReply_t} FountChatReply_t
 */

/**
 * Fount 聊天回复请求对象类型。
 * @typedef {import('../../../../../src/public/shells/chat/decl/chatLog.ts').chatReplyRequest_t} FountChatReplyRequest_t
 */

/**
 * Fount 插件 API 对象类型。
 * @typedef {import('../../../../../src/decl/pluginAPI.ts').pluginAPI_t} pluginAPI_t
 */

/**
 * Fount 世界观 API 对象类型。
 * @typedef {import('../../../../../src/decl/WorldAPI.ts').WorldAPI_t} WorldAPI_t
 */

/**
 * 扩展的 Fount 聊天日志条目类型，包含平台特定信息。
 * @typedef {FountChatLogEntryBase & {
 *  extension?: {
 *      platform: string,
 *      OwnerNameKeywords: string[],
 *      platform_message_ids?: any[],
 *      content_parts?: string[],
 *      platform_channel_id?: string | number,
 *      platform_user_id?: string | number,
 *      platform_guild_id?: string,
 *      mentions_bot?: boolean,
 *      mentions_owner?: boolean,
 *      is_direct_message?: boolean,
 *      is_from_owner?: boolean,
 *      [key: string]: any
 *  }
 * }} chatLogEntry_t_ext
 */

/**
 * 表示一个通用群组或服务器对象。
 * @typedef {{
 *  id: string | number;
 *  name: string;
 *  [key: string]: any;
 * }} GroupObject
 */

/**
 * 表示一个通用用户对象。
 * @typedef {{
 *  id: string | number;
 *  username: string;
 *  isBot?: boolean;
 *  [key: string]: any;
 * }} UserObject
 */

/**
 * 表示一个通用频道对象。
 * @typedef {{
 *  id: string | number;
 *  name: string;
 *  type?: string;
 *  [key: string]: any;
 * }} ChannelObject
 */

/**
 * 平台接口 API 对象类型定义。
 * @typedef {{
 *  name: string,
 *  sendMessage: (channelId: string | number, reply: FountChatReply_t, originalMessageEntry?: chatLogEntry_t_ext) => Promise<chatLogEntry_t_ext | null>,
 *  sendTyping: (channelId: string | number) => Promise<void>,
 *  fetchChannelHistory: (channelId: string | number, limit: number) => Promise<chatLogEntry_t_ext[]>,
 *  getBotUserId: () => string | number,
 *  getBotUsername: () => string,
 *  getBotDisplayName: () => string,
 *  getOwnerUserName: () => string,
 *  getOwnerUserId: () => string | number,
 *  getChatNameForAI: (channelId: string | number, triggerMessage?: chatLogEntry_t_ext) => string,
 *  destroySelf: () => Promise<void>,
 *  logError: (error: Error, contextMessage?: chatLogEntry_t_ext) => void,
 *  getPlatformSpecificPlugins: (messageEntry: chatLogEntry_t_ext) => Record<string, pluginAPI_t>,
 *  getPlatformWorld: () => WorldAPI_t,
 *  splitReplyText: (text: string) => string[],
 *  config: Record<string, any>,
 *  onGroupJoin?: (onJoinCallback: (group: GroupObject) => Promise<void>) => void,
 *  getJoinedGroups?: () => Promise<GroupObject[]>,
 *  getGroupMembers?: (groupId: string | number) => Promise<UserObject[]>,
 *  generateInviteLink?: (groupId: string | number, channelId?: string | number) => Promise<string | null>,
 *  leaveGroup?: (groupId: string | number) => Promise<void>,
 *  getGroupDefaultChannel?: (groupId: string | number) => Promise<ChannelObject | null>,
 *  sendDirectMessageToOwner?: (message: string) => Promise<void>,
 *  getOwnerPresenceInGroups?: () => Promise<{groupsWithOwner: GroupObject[], groupsWithoutOwner: GroupObject[]} | null>,
 *  onOwnerLeaveGroup?: (onLeaveCallback: (groupId: string | number, userId: string | number) => Promise<void>) => void
 * }} PlatformAPI_t
 */

/**
 * Bot 逻辑层配置对象类型定义。
 * @typedef {{
 *  DefaultMaxMessageDepth?: number,
 *  DefaultMaxFetchCount?: number,
 *  BaseTriggerChanceToOwner?: number,
 *  RepetitionTriggerCount?: number,
 *  MuteDurationMs?: number,
 *  InteractionFavorPeriodMs?: number,
 *  MergeMessagePeriodMs?: number,
 * }} BotLogicConfig_t
 */

/**
 * 记录机器人最后在各个频道发言的时间戳。
 * 键为频道 ID，值为毫秒级时间戳。
 * @type {Record<string | number, number>}
 */
const channelLastSendMessageTime = {}

/**
 * 存储各个频道的聊天记录。
 * 键为频道 ID，值为 {@link chatLogEntry_t_ext} 数组。
 * @type {Record<string | number, chatLogEntry_t_ext[]>}
 */
const channelChatLogs = {}

/**
 * 存储 AI 角色在各个频道的短期记忆 (由 AI 自身管理)。
 * 键为频道 ID，值为任意类型的记忆数据。
 * @type {Record<string | number, any>}
 */
const channelCharScopedMemory = {}

/**
 * 记录各个频道进入静默状态的开始时间戳。
 * 键为频道 ID，值为毫秒级时间戳。
 * @type {Record<string | number, number>}
 */
const channelMuteStartTimes = {}

/**
 * 简易错误去重记录，防止短时间内重复报告相同错误。
 * 键为错误消息的字符串表示，值为布尔值 true。
 * @type {Record<string, boolean>}
 */
const errorRecord = {}

/**
 * Bot 是否处于敷衍模式。
 * @type {boolean}
 */
let fuyanMode = false

/**
 * 当前 Bot 是否处于特定催眠模式的频道 ID。
 * 如果为 null，则 Bot 不处于任何催眠模式。
 * @type {string | number | null}
 */
let inHypnosisChannelId = null

/**
 * 禁止 Bot 输出的字符串列表。
 * @type {string[]}
 */
const bannedStrings = []

/**
 * 用户平台 ID 到显示名称的映射。
 * 用于在日志和 AI 请求中显示更友好的用户名称。
 * @type {Record<string | number, string>}
 */
const userIdToNameMap = {}

/**
 * 显示名称到用户平台 ID 的映射 (辅助功能，可能有冲突)。
 * 键为显示名称 (string)，值为用户 ID (string | number)。
 * @type {Record<string, string | number>}
 */
const nameToUserIdMap = {}

/**
 * 各个频道的消息处理队列。
 * 键为频道 ID，值为待处理的 {@link chatLogEntry_t_ext} 数组。
 * @type {Record<string | number, chatLogEntry_t_ext[]>}
 */
const channelMessageQueues = {}

/**
 * 记录各个频道当前是否有消息处理句柄 (Promise) 在运行。
 * 键为频道 ID，值为 Promise 对象。用于防止同一频道并发处理。
 * @type {Record<string | number, Promise<void>>}
 */
const channelHandlers = {}

/**
 * 当前 Bot 逻辑层的配置。
 * @type {BotLogicConfig_t}
 */
let currentConfig = {
	DefaultMaxMessageDepth: 20,
	DefaultMaxFetchCount: 30,
	BaseTriggerChanceToOwner: 7,
	RepetitionTriggerCount: 4,
	MuteDurationMs: 3 * 60 * 1000,
	InteractionFavorPeriodMs: 3 * 60 * 1000,
	MergeMessagePeriodMs: 3 * 60 * 1000,
}

const GentianWords = ['龙胆', 'gentian']

/**
 * 配置 Bot 逻辑层。
 * @param {Partial<BotLogicConfig_t>} newConfig - 一个包含部分或全部新配置项的对象。
 */
export function configure(newConfig) {
	currentConfig = { ...currentConfig, ...newConfig }
	if (currentConfig.DefaultMaxMessageDepth && (!newConfig.DefaultMaxFetchCount || newConfig.DefaultMaxFetchCount < currentConfig.DefaultMaxMessageDepth))
		currentConfig.DefaultMaxFetchCount = Math.floor(currentConfig.DefaultMaxMessageDepth * 3 / 2) || currentConfig.DefaultMaxMessageDepth
}

/**
 * 更新机器人自身在特定平台上的名称映射 (ID到名称，名称到ID)。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 */
function updateBotNameMapping(platformAPI) {
	const botPlatformId = platformAPI.getBotUserId()
	const botPlatformUsername = platformAPI.getBotUsername()
	const botDefaultDisplayName = platformAPI.getBotDisplayName()

	if (botPlatformId) {
		const primaryDisplayName = `${botPlatformUsername || botDefaultDisplayName || BotCharname} (咱自己)`
		userIdToNameMap[botPlatformId] = primaryDisplayName
		nameToUserIdMap[primaryDisplayName] = botPlatformId

		const normalizedBotName = (botPlatformUsername || BotCharname).replace(/gentian/ig, '龙胆')
		if (normalizedBotName && (!nameToUserIdMap[normalizedBotName] || nameToUserIdMap[normalizedBotName] !== botPlatformId))
			nameToUserIdMap[normalizedBotName] = botPlatformId

		if (botPlatformUsername && botPlatformUsername !== primaryDisplayName.split(' ')[0] && (!nameToUserIdMap[botPlatformUsername] || nameToUserIdMap[botPlatformUsername] !== botPlatformId))
			nameToUserIdMap[botPlatformUsername] = botPlatformId

		if (botDefaultDisplayName && botDefaultDisplayName !== botPlatformUsername && botDefaultDisplayName !== primaryDisplayName.split(' ')[0] && (!nameToUserIdMap[botDefaultDisplayName] || nameToUserIdMap[botDefaultDisplayName] !== botPlatformId))
			nameToUserIdMap[botDefaultDisplayName] = botPlatformId

	}
}

/**
 * 合并聊天记录条目。
 * @param {chatLogEntry_t_ext[]} logEntries - 待合并的聊天记录条目数组。
 * @returns {chatLogEntry_t_ext[]} 合并后的聊天记录条目数组。
 */
function mergeChatLogEntries(logEntries) {
	if (!logEntries || logEntries.length === 0) return []
	const newLog = []
	let lastEntry = { ...logEntries[0], extension: { ...logEntries[0].extension || {}, platform_message_ids: [...logEntries[0].extension?.platform_message_ids || []] } }

	for (let i = 1; i < logEntries.length; i++) {
		const currentEntry = logEntries[i]
		if (
			lastEntry.name === currentEntry.name &&
			currentEntry.timeStamp - lastEntry.timeStamp < currentConfig.MergeMessagePeriodMs &&
			(lastEntry.files || []).length === 0
		) {
			lastEntry.content += '\n' + currentEntry.content
			lastEntry.files = currentEntry.files
			lastEntry.timeStamp = currentEntry.timeStamp
			lastEntry.extension = {
				...lastEntry.extension,
				...currentEntry.extension,
				platform_message_ids: Array.from(new Set([
					...lastEntry.extension?.platform_message_ids || [],
					...currentEntry.extension?.platform_message_ids || []
				]))
			}
		} else {
			newLog.push(lastEntry)
			lastEntry = { ...currentEntry, extension: { ...currentEntry.extension || {}, platform_message_ids: [...currentEntry.extension?.platform_message_ids || []] } }
		}
	}
	newLog.push(lastEntry)
	return newLog
}

function isBotCommand(str) {
	return Boolean(str.match(/^[!$%&/\\！]/))
}

/**
 * 检查传入的消息是否应该触发机器人回复。
 * @async
 * @param {chatLogEntry_t_ext} fountEntry - 当前正在处理的 Fount 格式消息条目。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {string | number} channelId - 消息所在的频道 ID。
 * @param {{has_other_gentian_bot?: boolean}} [env={}] - 环境信息对象。
 * @returns {Promise<boolean>} 如果应该回复则返回 true，否则返回 false。
 */
async function checkMessageTrigger(fountEntry, platformAPI, channelId, env = {}) {
	const content = (fountEntry.content || '').replace(/^(@\S+\s+)+/g, '')
	const botUserId = platformAPI.getBotUserId()
	const isFromOwner = fountEntry.extension?.is_from_owner === true

	if (fountEntry.extension?.is_direct_message)
		return isFromOwner

	if (inHypnosisChannelId && inHypnosisChannelId === channelId && !isFromOwner)
		return false

	let possible = 0

	const EngWords = content.split(' ')
	const oldLogicChineseCheck = base_match_keys(
		content.substring(0, 5) + ' ' + content.substring(content.length - 5),
		['龙胆']
	)
	const oldLogicEnglishCheck = base_match_keys(
		EngWords.slice(0, 6).concat(EngWords.slice(-3)).join(' '),
		['gentian']
	)
	const nameMentionedByOldLogic = oldLogicChineseCheck || oldLogicEnglishCheck

	const mentionedWithoutAt = !env.has_other_gentian_bot &&
		nameMentionedByOldLogic &&
		!base_match_keys(content, [/(龙胆(有|能|这边|目前|[^ 。你，]{0,3}的)|gentian('s|is|are|can|has))/i]) &&
		!base_match_keys(content, [/^.{0,4}龙胆$/i])

	possible += base_match_keys(content, fountEntry.extension.OwnerNameKeywords) * 7
	possible += base_match_keys(content, GentianWords) * 5
	possible += base_match_keys(content, [/(花|华)(萝|箩|罗)(蘑|磨|摩)/g]) * 3

	const isABotCommand = isBotCommand(content)

	const timeSinceLastBotMessageInChannel = fountEntry.timeStamp - (channelLastSendMessageTime[channelId] || 0)
	const isInFavor = timeSinceLastBotMessageInChannel < currentConfig.InteractionFavorPeriodMs

	let isMutedChannel = (Date.now() - (channelMuteStartTimes[channelId] || 0)) < currentConfig.MuteDurationMs

	if (isFromOwner) {
		if (mentionedWithoutAt || fountEntry.extension?.mentions_bot) {
			possible += 100
			delete channelMuteStartTimes[channelId]
			isMutedChannel = false
		}
		if ((isMutedChannel || isInFavor) && base_match_keys(content, ['闭嘴', '安静', '肃静']) && content.length < 10) {
			channelMuteStartTimes[channelId] = Date.now()
			isMutedChannel = true
			return false
		}

		if (base_match_keys(content, ['老婆', '女票', '女朋友', '炮友'])) possible += 50
		if (base_match_keys(content, [/(有点|好)紧张/, '救救', '帮帮', /帮(我|(你|你家)?(主人|老公|丈夫|爸爸|宝宝))/, '来人', '咋用', '教教', /是真的(吗|么)/])) possible += 100
		if (base_match_keys(content, GentianWords) && base_match_keys(content, [/怎么(想|看)/])) possible += 100
		if (base_match_keys(content, ['睡了', '眠了', '晚安', '睡觉去了'])) possible += 50
		if (base_match_keys(content, ['失眠了', '睡不着'])) possible += 100
		if (base_match_keys(content, ['早上好', '早安'])) possible += 100

		if (isInFavor) {
			possible += 4
			const currentChannelLog = channelChatLogs[channelId] || []
			const lastBotMsgIndex = currentChannelLog.findLastIndex(log => log.extension?.platform_user_id == botUserId)

			const messagesSinceLastBotReply = lastBotMsgIndex === -1
				? currentChannelLog.length
				: currentChannelLog.slice(lastBotMsgIndex + 1).length

			if (base_match_keys(content, [
				/(再|多)(来|表演)(点|.*(次|个))/, '来个', '不够', '不如', '继续', '确认', '执行',
				/^(那|所以你|可以再|你?再(讲|说|试试|猜)|你(觉得|想|知道|确定|试试)|但是|我?是说)/, /^so/i,
			]) && messagesSinceLastBotReply <= 3)
				possible += 100

		}
		if (!isABotCommand) possible += currentConfig.BaseTriggerChanceToOwner
	}
	else
		if (mentionedWithoutAt) {
			if (isInFavor) possible += 90
			else possible += 40
			if (base_match_keys(content, [/[午安早晚]安/])) possible += 100
		}
		else if (fountEntry.extension?.mentions_bot) {
			possible += 40
			if (base_match_keys(content, [/\?|？/, '怎么', '什么', '吗', /(大|小)还是/, /(还是|哪个)(大|小)/])) possible += 100
			if (base_match_keys(content, rude_words))
				if (fuyanMode) return false
				else possible += 100

			if (base_match_keys(content, ['你主人', '你的主人'])) possible += 100
		}

	if (fountEntry.extension?.mentions_owner || base_match_keys(content, fountEntry.extension.OwnerNameKeywords)) {
		possible += 7
		if (base_match_keys(content, rude_words))
			if (fuyanMode) return false
			else return true
	}

	if (isMutedChannel)
		return false
	else if (channelMuteStartTimes[channelId] && !base_match_keys(content, ['闭嘴', '安静', '肃静']))
		delete channelMuteStartTimes[channelId]

	const okey = Math.random() * 100 < possible
	console.dir({
		chat_name: platformAPI.getChatNameForAI(channelId, fountEntry),
		name: fountEntry.name,
		content,
		files: fountEntry.files,
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

	return okey
}

/**
 * 内部核心回复处理逻辑。
 * @async
 * @param {chatLogEntry_t_ext} triggerMessage - 触发本次回复的原始消息条目。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {string | number} channelId - 消息所在的频道 ID。
 */
async function doMessageReplyInternal(triggerMessage, platformAPI, channelId) {
	let typingInterval = setInterval(() => { platformAPI.sendTyping(channelId).catch(_ => { }) }, 5000)
	function clearTypingInterval() {
		if (typingInterval) typingInterval = clearInterval(typingInterval)
	}

	updateBotNameMapping(platformAPI)

	try {
		const currentChannelChatLog = channelChatLogs[channelId] || []
		channelCharScopedMemory[channelId] ??= {}

		const activePlugins = platformAPI.getPlatformSpecificPlugins(triggerMessage) || {}
		const platformWorld = platformAPI.getPlatformWorld() || null

		const chatNameForAI = platformAPI.getChatNameForAI(channelId, triggerMessage)

		const fountBotDisplayName = (await GentianAphrodite.getPartInfo?.(localhostLocales[0]))?.name || BotCharname
		const botNameForAIChat = userIdToNameMap[platformAPI.getBotUserId()] || `${platformAPI.getBotUsername()} (咱自己)` || `${fountBotDisplayName} (咱自己)`

		const ownerPlatformUsername = platformAPI.getOwnerUserName()
		const ownerPlatformId = platformAPI.getOwnerUserId()

		const replyToCharName = userIdToNameMap[triggerMessage.extension?.platform_user_id || ''] || triggerMessage.name

		const userCharNameForAI = triggerMessage.extension.is_from_owner ? replyToCharName : userIdToNameMap[ownerPlatformId] || ownerPlatformUsername

		/** @type {FountChatReplyRequest_t} */
		const replyRequest = {
			supported_functions: { markdown: true, files: true, add_message: true, mathjax: true, html: false, unsafe_html: false },
			username: FountUsername,
			chat_name: chatNameForAI,
			char_id: BotCharname,
			Charname: botNameForAIChat,
			UserCharname: userCharNameForAI,
			ReplyToCharname: replyToCharName,
			locales: localhostLocales,
			time: new Date(),
			world: platformWorld,
			user: null,
			char: GentianAphrodite,
			other_chars: [],
			plugins: activePlugins,
			chat_scoped_char_memory: channelCharScopedMemory[channelId],
			chat_log: currentChannelChatLog,
			async AddChatLogEntry(replyFromChar) {
				if (replyFromChar && (replyFromChar.content || replyFromChar.files?.length))
					return await sendAndLogReply(replyFromChar, platformAPI, channelId, triggerMessage)

				return null
			},
			async Update() {
				const updatedRequest = { ...this }
				updatedRequest.chat_log = channelChatLogs[channelId] || []
				updatedRequest.chat_scoped_char_memory = channelCharScopedMemory[channelId]
				updatedRequest.time = new Date()
				return updatedRequest
			},
			extension: {
				platform: platformAPI.name,
				trigger_message_id: triggerMessage.extension?.platform_message_ids?.[0],
				chat_id: channelId,
				user_id: triggerMessage.extension?.platform_user_id,
				...triggerMessage.extension
			}
		}

		const aiFinalReply = fuyanMode ? { content: '嗯嗯！' } : await GentianAphrodite.interfaces.chat.GetReply(replyRequest)

		if (channelCharScopedMemory[channelId]?.in_hypnosis)
			inHypnosisChannelId = channelId
		else
			inHypnosisChannelId = null

		if (!aiFinalReply)
			return

		for (const bannedStr of bannedStrings)
			if (aiFinalReply.content) aiFinalReply.content = aiFinalReply.content.replaceAll(bannedStr, '')

		if (aiFinalReply && (aiFinalReply.content || aiFinalReply.files?.length))
			await sendAndLogReply(aiFinalReply, platformAPI, channelId, aiFinalReply.extension?.replied_to_message_id ? undefined : triggerMessage)
	} catch (error) {
		await handleError(error, platformAPI, triggerMessage)
	} finally {
		clearTypingInterval()
	}
}

/**
 * 发送回复并记录日志的辅助函数。
 * @async
 * @param {FountChatReply_t} replyToSend - AI 生成的待发送回复对象。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {string | number} channelId - 目标频道 ID。
 * @param {chatLogEntry_t_ext | undefined} repliedToMessageEntry - (可选) 被回复的原始消息条目。
 * @returns {Promise<chatLogEntry_t_ext | null>} 返回第一条成功发送的消息对应的 Fount Entry，如果发送失败或无内容则返回 null。
 */
async function sendAndLogReply(replyToSend, platformAPI, channelId, repliedToMessageEntry) {
	const currentChannelChatLog = channelChatLogs[channelId] || []
	if (
		repliedToMessageEntry &&
		currentChannelChatLog.length > 0 &&
		currentChannelChatLog[currentChannelChatLog.length - 1]?.extension?.platform_message_ids?.some(id => repliedToMessageEntry.extension?.platform_message_ids?.includes(id)) &&
		(channelMessageQueues[channelId] || []).length === 0
	)
		repliedToMessageEntry = undefined

	if (!replyToSend.content && !replyToSend.files?.length) {
		console.warn('[BotLogic] sendAndLogReply: Attempted to send empty message, skipped.', replyToSend)
		return null
	}

	return await platformAPI.sendMessage(channelId, replyToSend, repliedToMessageEntry)
}

/**
 * 处理单个频道的消息队列。
 * @async
 * @param {string | number} channelId - 当前正在处理的频道 ID。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 */
async function handleMessageQueue(channelId, platformAPI) {
	if (!channelMessageQueues[channelId]?.length)
		return delete channelHandlers[channelId]

	if (!channelChatLogs[channelId] || channelChatLogs[channelId].length === 0) {
		const historicalMessages = await platformAPI.fetchChannelHistory(channelId, currentConfig.DefaultMaxFetchCount)
		const mergedHistoricalLog = mergeChatLogEntries(historicalMessages.sort((a, b) => a.timeStamp - b.timeStamp).slice(0, -1))
		channelChatLogs[channelId] = mergedHistoricalLog
		while (channelChatLogs[channelId].length > currentConfig.DefaultMaxMessageDepth)
			channelChatLogs[channelId].shift()
	}
	const myQueue = channelMessageQueues[channelId]
	const currentChannelLog = channelChatLogs[channelId]

	while (myQueue.length) try {
		let currentMessageToProcess = myQueue[0]
		if (!currentMessageToProcess) { myQueue.shift(); continue }

		const lastLogEntry = currentChannelLog.length > 0 ? currentChannelLog[currentChannelLog.length - 1] : null
		function is_can_marge() {
			return lastLogEntry && currentMessageToProcess &&
				lastLogEntry.name === currentMessageToProcess.name &&
				currentMessageToProcess.timeStamp - lastLogEntry.timeStamp < currentConfig.MergeMessagePeriodMs &&
				(lastLogEntry.files || []).length === 0 &&
				(lastLogEntry.logContextAfter || []).length === 0 &&
				lastLogEntry.extension?.platform_message_ids &&
				currentMessageToProcess.extension?.platform_message_ids
		}
		async function checkTrigger() {
			if (currentMessageToProcess.extension?.platform_user_id == platformAPI.getBotUserId())
				return

			if (currentMessageToProcess.extension?.is_from_owner) {
				const { content } = currentMessageToProcess
				if (!inHypnosisChannelId || channelId === inHypnosisChannelId) {
					if (base_match_keys(content, [/^龙胆.{0,2}敷衍点.{0,2}$/])) fuyanMode = true
					if (base_match_keys(content, [/^龙胆.{0,2}不敷衍点.{0,2}$/])) fuyanMode = false
					if (base_match_keys(content, [/^龙胆.{0,2}自裁.{0,2}$/])) {
						const selfDestructReply = inHypnosisChannelId === channelId ? { content: '好的。' } : { content: '啊，咱死了～' }
						await sendAndLogReply(selfDestructReply, platformAPI, channelId, currentMessageToProcess)
						newUserMessage(content, platformAPI.name)
						newCharReplay(selfDestructReply.content, platformAPI.name)
						await platformAPI.destroySelf()
						return 'exit'
					}
					const repeatMatch = content.match(/^龙胆.{0,2}复诵.{0,2}`(?<repeat_content>[\S\s]*)`$/)
					if (repeatMatch?.groups?.repeat_content) {
						await sendAndLogReply({ content: repeatMatch.groups.repeat_content }, platformAPI, channelId, currentMessageToProcess)
						newUserMessage(content, platformAPI.name)
						newCharReplay(repeatMatch.groups.repeat_content, platformAPI.name)
						return
					}
					const banWordMatch = content.match(/^龙胆.{0,2}禁止.{0,2}`(?<banned_content>[\S\s]*)`$/)
					if (banWordMatch?.groups?.banned_content)
						bannedStrings.push(banWordMatch.groups.banned_content)
					if (base_match_keys(content, [/^[\n,.~、。呵哦啊嗯噫欸胆龙，～]+$/, /^[\n,.~、。呵哦啊嗯噫欸胆龙，～]{4}[\n!,.?~、。呵哦啊嗯噫欸胆龙！，？～]+$/])) {
						const ownerCallReply = SimplifyChinese(content).replaceAll('龙', '主').replaceAll('胆', '人')
						await sendAndLogReply({ content: ownerCallReply }, platformAPI, channelId, currentMessageToProcess)
						newUserMessage(content, platformAPI.name)
						newCharReplay(ownerCallReply, platformAPI.name)
						return
					}
				}
			}

			const recentChatLogForOtherBotCheck = currentChannelLog.filter(msg => (Date.now() - msg.timeStamp) < 5 * 60 * 1000)
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
				return 1
			else if (ownerBotOnlyInteraction && currentMessageToProcess.extension?.is_from_owner && !isMutedChannel)
				return 1
			else if (
				(!inHypnosisChannelId || channelId !== inHypnosisChannelId) &&
				!isMutedChannel &&
				currentMessageToProcess.extension?.platform_user_id != platformAPI.getBotUserId()
			) {
				const nameMap = {}
				function summary(message, name_diff = true) {
					let result = ''
					if (name_diff) {
						nameMap[message.name] ??= 0
						result += nameMap[message.name]++ + '\n'
					}
					result += (message.content ?? '') + '\n\n'
					result += (message.files || []).map(file => file.buffer instanceof Buffer ? file.buffer.toString('hex') : String(file.buffer)).join('\n')
					return result
				}
				const repet = findMostFrequentElement(currentChannelLog.slice(-10), summary)
				if (
					(repet.element?.content || repet.element?.files?.length) &&
					repet.count >= currentConfig.RepetitionTriggerCount &&
					!base_match_keys(repet.element.content + '\n' + (repet.element.files || []).map(file => file.name).join('\n'), [...currentMessageToProcess.extension.OwnerNameKeywords, ...rude_words, ...GentianWords]) &&
					!isBotCommand(repet.element.content) &&
					!currentChannelLog.slice(-10).some(msg => msg.extension?.platform_user_id == platformAPI.getBotUserId() && summary(msg, false) === summary(repet.element, false))
				)
					await sendAndLogReply(
						{ content: repet.element.content, files: repet.element.files },
						platformAPI, channelId, currentMessageToProcess
					)
			}
		}
		let triggered = false
		if (!is_can_marge()) {
			currentChannelLog.push(currentMessageToProcess)
			myQueue.shift()
			switch (await checkTrigger()) {
				case 'exit': return
				case 1: triggered = true
			}
		}
		else do {
			lastLogEntry.content = (lastLogEntry.extension.content_parts || [lastLogEntry.content])
				.concat(currentMessageToProcess.extension.content_parts || [currentMessageToProcess.content])
				.join('\n')

			lastLogEntry.files = currentMessageToProcess.files
			lastLogEntry.timeStamp = currentMessageToProcess.timeStamp
			lastLogEntry.extension = {
				...lastLogEntry.extension,
				...currentMessageToProcess.extension,
				platform_message_ids: [
					...lastLogEntry.extension.platform_message_ids || [],
					...currentMessageToProcess.extension.platform_message_ids || []
				],
				// 合并 content_parts 数组
				content_parts: (lastLogEntry.extension.content_parts || [])
					.concat(currentMessageToProcess.extension.content_parts || [currentMessageToProcess.content])
			}

			myQueue.shift()
			switch (await checkTrigger()) {
				case 'exit': return
				case 1: triggered = true
			}
			currentMessageToProcess = myQueue[0]
		} while (is_can_marge())

		while (currentChannelLog.length > currentConfig.DefaultMaxMessageDepth)
			currentChannelLog.shift()

		currentMessageToProcess = currentChannelLog[currentChannelLog.length - 1]
		if (triggered)
			await doMessageReplyInternal(currentMessageToProcess, platformAPI, channelId)
	} catch (error) {
		const lastMessageInQueueOrLog = myQueue.length > 0 ? myQueue[myQueue.length - 1] : currentChannelLog?.slice(-1)[0]
		await handleError(error, platformAPI, lastMessageInQueueOrLog)
	} finally {
		if (channelMessageQueues[channelId] && channelMessageQueues[channelId].length === 0)
			delete channelHandlers[channelId]
	}
}

/**
 * 统一错误处理函数。
 * @async
 * @param {Error} error - 发生的错误对象。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {chatLogEntry_t_ext | undefined} contextMessage - (可选) 发生错误时的上下文消息条目。
 */
async function handleError(error, platformAPI, contextMessage) {
	const errorStack = error.stack || error.message
	const errorMessageForRecord = `\`\`\`\n${errorStack}\n\`\`\``

	if (errorRecord[errorMessageForRecord]) return
	errorRecord[errorMessageForRecord] = true
	setTimeout(() => delete errorRecord[errorMessageForRecord], 60000)

	let aiSuggestionReply
	try {
		const botPlatformId = platformAPI.getBotUserId()
		const fountBotDisplayName = (await GentianAphrodite.getPartInfo?.(localhostLocales[0]))?.name || BotCharname
		const botNameForAI = userIdToNameMap[botPlatformId] || `${platformAPI.getBotUsername()} (咱自己)` || `${fountBotDisplayName} (咱自己)`

		const ownerPlatformUsername = platformAPI.getOwnerUserName()
		const ownerPlatformId = platformAPI.getOwnerUserId()
		const ownerNameForAI = userIdToNameMap[ownerPlatformId] || ownerPlatformUsername || FountUsername

		const currentChannelId = contextMessage?.extension?.platform_channel_id
		const isInHypnosisForError = !!(currentChannelId && currentChannelId === inHypnosisChannelId)

		const selfRepairChatLog = [
			{
				name: botNameForAI,
				content: isInHypnosisForError ? '请主人下达指令。' : '主人，有什么我可以帮到您的吗～？',
				timeStamp: new Date().getTime(),
				role: 'char',
				extension: {}
			}, {
				name: ownerNameForAI,
				content: errorMessageForRecord + `
龙胆，我该如何解决这个错误？可以的话你来直接修复它。
注意的点：
- 以修正出问题的文件为主，宏观上没什么好修复的
- fount项目基于deno，没有package.json
- 不要删除整个项目并重新下载，那会删除你自己和我的用户配置
- 不能修复也没问题，帮我分析下报错也可以，不会怪你
`,
				timeStamp: new Date().getTime(),
				role: 'user',
				extension: {}
			}, {
				name: 'system',
				content: isInHypnosisForError ? '在回复时保持呆滞语气。' : '在回复问题时保持少女语气，适当添加语气词。',
				timeStamp: new Date().getTime(),
				role: 'system',
				extension: {}
			}
		]

		const chatNameForSelfRepair = platformAPI.getChatNameForAI(
			currentChannelId || 'self-repair-context',
			contextMessage
		)

		/** @type {FountChatReplyRequest_t} */
		const selfRepairRequest = {
			supported_functions: { markdown: true, mathjax: true, html: false, unsafe_html: false, files: true, add_message: false },
			username: FountUsername,
			chat_name: chatNameForSelfRepair,
			char_id: BotCharname,
			Charname: botNameForAI,
			UserCharname: ownerNameForAI,
			locales: localhostLocales,
			time: new Date(),
			world: platformAPI.getPlatformWorld(),
			user: null,
			char: GentianAphrodite,
			other_chars: [],
			plugins: {},
			chat_scoped_char_memory: {},
			chat_log: selfRepairChatLog,
			extension: { platform: contextMessage?.extension?.platform || 'unknown' }
		}

		aiSuggestionReply = await GentianAphrodite.interfaces.chat.GetReply(selfRepairRequest)

	} catch (anotherError) {
		const anotherErrorStack = anotherError.stack || anotherError.message
		const currentChannelId = contextMessage?.extension?.platform_channel_id
		const isHypnosisContextForError = !!(inHypnosisChannelId && currentChannelId && currentChannelId === inHypnosisChannelId)

		if (`${error.name}: ${error.message}` === `${anotherError.name}: ${anotherError.message}`)
			aiSuggestionReply = { content: isHypnosisContextForError ? '抱歉，洗脑母畜龙胆没有解决思路。' : '没什么解决思路呢？' }
		else
			aiSuggestionReply = { content: '```\n' + anotherErrorStack + '\n```\n' + (isHypnosisContextForError ? '抱歉，洗脑母畜龙胆没有解决思路。' : '没什么解决思路呢？') }

	}

	let fullReplyContent = errorMessageForRecord + '\n' + (aiSuggestionReply?.content || '')
	const randomIPDict = {}
	fullReplyContent = fullReplyContent.replace(/(?:\d{1,3}\.){3}\d{1,3}/g, ip => randomIPDict[ip] ??= Array(4).fill(0).map(() => Math.floor(Math.random() * 255)).join('.'))

	try {
		if (contextMessage?.extension?.platform_channel_id)
			await sendAndLogReply({ content: fullReplyContent }, platformAPI, contextMessage.extension.platform_channel_id, undefined)
		else
			platformAPI.logError(new Error('[BotLogic] Error occurred (no context channel to reply): ' + fullReplyContent.substring(0, 1000) + '...'), undefined)
	} catch (sendError) {
		platformAPI.logError(sendError, contextMessage)
		console.error('[BotLogic] Failed to send error notification. Original error:', error, 'Send error:', sendError)
	}
	platformAPI.logError(error, contextMessage)
	console.error('[BotLogic] Original error handled:', error, 'Context:', contextMessage)
	await reloadPart(FountUsername, 'chars', BotCharname)
}

/**
 * 处理从接入层传入的新消息。
 * @async
 * @param {chatLogEntry_t_ext} fountEntry - 已经由接入层转换为 Fount 格式的平台消息条目。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {string | number} channelId - 消息所在的频道 ID。
 */
export async function processIncomingMessage(fountEntry, platformAPI, channelId) {
	try {
		updateBotNameMapping(platformAPI)

		const senderId = fountEntry.extension?.platform_user_id
		const senderName = fountEntry.name
		if (senderId && senderName) {
			if (!userIdToNameMap[senderId] || userIdToNameMap[senderId] !== senderName)
				userIdToNameMap[senderId] = senderName

			if (!nameToUserIdMap[senderName] || nameToUserIdMap[senderName] !== senderId)
				nameToUserIdMap[senderName] = senderId
		}

		channelMessageQueues[channelId] ??= []
		channelMessageQueues[channelId].push(fountEntry)

		if (!channelHandlers[channelId])
			channelHandlers[channelId] = handleMessageQueue(channelId, platformAPI)
				.catch(err => {
					handleError(err, platformAPI, fountEntry)
				})
				.finally(() => {
					if (channelMessageQueues[channelId]?.length === 0)
						delete channelHandlers[channelId]
				})
	} catch (error) {
		await handleError(error, platformAPI, fountEntry)
	}
}

/**
 * 处理从接入层传入的消息更新事件 (例如，消息被编辑)。
 * @async
 * @param {chatLogEntry_t_ext} updatedFountEntry - 包含更新信息的新的 Fount 格式消息条目。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {string | number} channelId - 消息所在的频道 ID。
 */
export async function processMessageUpdate(updatedFountEntry, platformAPI, channelId) {
	const log = channelChatLogs[channelId]
	if (!log || !updatedFountEntry.extension?.platform_message_ids?.length) return

	const updatedMsgId = updatedFountEntry.extension.platform_message_ids[0]

	const entryIndex = log.findIndex(entry =>
		entry.extension?.platform_message_ids?.includes(updatedMsgId)
	)

	if (entryIndex > -1) {
		const entryToUpdate = log[entryIndex]
		const partIndex = entryToUpdate.extension.platform_message_ids.indexOf(updatedMsgId)

		if (partIndex > -1) {
			// 更新特定部分的内容
			const newContentPart = ((updatedFountEntry.extension.content_parts?.[0] || updatedFountEntry.content)).replace(/（已编辑）$/, '') + '（已编辑）'
			entryToUpdate.extension.content_parts[partIndex] = newContentPart

			// 更新时间戳和文件（如果编辑时添加了文件）
			entryToUpdate.timeStamp = updatedFountEntry.timeStamp
			if (updatedFountEntry.files?.length)
				entryToUpdate.files = [...entryToUpdate.files || [], ...updatedFountEntry.files]

			// 重新生成完整的 content 字符串
			entryToUpdate.content = entryToUpdate.extension.content_parts.join('\n')
		}
	}
}

/**
 * 处理从接入层传入的消息删除事件。
 * @async
 * @param {any} deletedMessageId - 被删除消息的平台特定 ID。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {string | number} channelId - 消息所在的频道 ID。
 */
export async function processMessageDelete(deletedMessageId, platformAPI, channelId) {
	const log = channelChatLogs[channelId]
	if (!log) return

	const entryIndex = log.findIndex(entry =>
		entry.extension?.platform_message_ids?.includes(deletedMessageId)
	)

	if (entryIndex > -1) {
		const entryToUpdate = log[entryIndex]
		const partIndex = entryToUpdate.extension.platform_message_ids.indexOf(deletedMessageId)

		if (partIndex > -1 && entryToUpdate.extension.content_parts?.[partIndex]) {
			// 在特定部分内容后追加（已删除）
			entryToUpdate.extension.content_parts[partIndex] += '（已删除）'

			// 重新生成完整的 content 字符串
			entryToUpdate.content = entryToUpdate.extension.content_parts.join('\n')
		}
	}
}

/**
 * Bot 清理函数。
 * 在应用关闭前调用，以确保所有正在处理的任务完成。
 * @async
 */
export async function cleanup() {
	await Promise.allSettled(Object.values(channelHandlers).filter(Boolean))
}

/**
 * 检查群组中是否存在主人，并在主人不在时执行相应操作。
 * @param {import('./index.mjs').GroupObject} group - 要检查的群组。
 * @param {import('./index.mjs').PlatformAPI_t} platformAPI - 平台 API 实例。
 * @param {string | number | null} ownerOverride - (可选) 测试用的主人用户 ID 覆盖。
 */
async function handleGroupCheck(group, platformAPI, ownerOverride = null) {
	if (!group || !platformAPI) {
		console.error('[BotLogic] handleGroupCheck: Invalid group or platformAPI provided.')
		return
	}

	try {
		const ownerIdToCompare = ownerOverride || platformAPI.getOwnerUserId?.()
		const ownerUsernameToCompare = platformAPI.getOwnerUserName?.()

		let ownerIsPresent = false
		if (platformAPI.getGroupMembers) {
			const members = await platformAPI.getGroupMembers(group.id)
			if (members)
				ownerIsPresent = members.some(member =>
					String(member.id) === String(ownerIdToCompare) ||
					(member.username && ownerUsernameToCompare && member.username.toLowerCase() === ownerUsernameToCompare.toLowerCase())
				)
			else
				console.warn(`[BotLogic] Could not retrieve members for group ${group.id} on ${platformAPI.name}. Skipping owner check.`)

		} else
			console.warn(`[BotLogic] getGroupMembers not implemented for platform ${platformAPI.name}. Cannot check owner presence in group ${group.id}. Skipping.`)

		if (ownerIsPresent) return

		console.log(`[BotLogic] Owner NOT found in group ${group.name} (ID: ${group.id}). Taking action...`)

		const defaultChannel = await platformAPI.getGroupDefaultChannel?.(group.id)
		if (!defaultChannel) {
			console.warn(`[BotLogic] Could not find a default channel for group ${group.id}. Cannot send invite or message.`)
			await platformAPI.leaveGroup?.(group.id)
			return
		}

		let inviteLink = null
		if (platformAPI.generateInviteLink)
			inviteLink = await platformAPI.generateInviteLink(group.id, defaultChannel.id)
				.catch(error => {
					console.error(`[BotLogic] Error generating invite link for group ${group.id}:`, error.stack)
					return error
				})

		if (inviteLink) {
			const inviteMessage = `咱被拉入了一个您不在的群组（已经退啦！）: \`${group.name}\` (ID: \`${group.id}\`)\n链接: ${inviteLink}`
			if (platformAPI.sendDirectMessageToOwner)
				await platformAPI.sendDirectMessageToOwner(inviteMessage)
			else
				console.warn(`[BotLogic] sendDirectMessageToOwner not implemented for ${platformAPI.name}.`)

			const ownerPresenceResult = await platformAPI.getOwnerPresenceInGroups?.()
			if (ownerPresenceResult?.groupsWithOwner?.length > 0)
				for (const otherGroup of ownerPresenceResult.groupsWithOwner) {
					if (otherGroup.id === group.id) continue

					const otherGroupDefaultChannel = await platformAPI.getGroupDefaultChannel?.(otherGroup.id)
					if (otherGroupDefaultChannel && platformAPI.sendMessage)
						try {
							await platformAPI.sendMessage(otherGroupDefaultChannel.id, { content: `@${ownerUsernameToCompare} ` + inviteMessage })
						} catch (e) {
							console.error(`[BotLogic] Failed to send invite message to owner in group ${otherGroup.name}:`, e)
						}
				}

		} else
			console.warn(`[BotLogic] Could not generate invite link for group ${group.id}.`)

		const groupNameForAI = group.name || `Group ${group.id}`
		let channelHistoryForAI = []
		if (platformAPI.fetchChannelHistory)
			channelHistoryForAI = await platformAPI.fetchChannelHistory(defaultChannel.id, 10)

		const insultRequestContext = [
			...channelHistoryForAI,
			{
				name: 'system',
				role: 'system',
				timeStamp: Date.now(),
				content: `\
你目前在${groupNameForAI}群组中，但这里没有找到你的主人，显然你是被某个傻逼拉进来的。
现在发挥你的聪明才智随便骂几句，随后你会自动退出群组。
` },
		]

		const fountBotDisplayName = (await GentianAphrodite.getPartInfo?.(localhostLocales[0]))?.name || BotCharname
		const botUserId = platformAPI.getBotUserId?.()
		const botUsername = platformAPI.getBotUsername?.()
		const botDisplayName = platformAPI.getBotDisplayName?.()
		const botNameForAIChat = userIdToNameMap[botUserId] || `${botUsername} (咱自己)` || `${botDisplayName} (咱自己)` || `${fountBotDisplayName} (咱自己)`

		const ownerPlatformUsernameForAI = platformAPI.getOwnerUserName?.()
		const ownerPlatformIdForAI = platformAPI.getOwnerUserId?.()
		const userCharNameForAI = userIdToNameMap[ownerPlatformIdForAI] || ownerPlatformUsernameForAI

		const insultRequest = {
			supported_functions: { markdown: true, files: false, add_message: false, mathjax: false, html: false, unsafe_html: false },
			username: FountUsername,
			chat_name: platformAPI.getChatNameForAI(group.id, { extension: { platform_guild_id: group.id, platform_channel_id: defaultChannel.id, platform: platformAPI.name } }),
			char_id: BotCharname,
			Charname: botNameForAIChat,
			UserCharname: userCharNameForAI,
			ReplyToCharname: '',
			locales: localhostLocales,
			time: new Date(),
			world: platformAPI.getPlatformWorld?.() || null,
			user: null,
			char: GentianAphrodite,
			other_chars: [],
			plugins: { ...platformAPI.getPlatformSpecificPlugins?.({ extension: { platform_guild_id: group.id, platform_channel_id: defaultChannel.id, platform: platformAPI.name } } || {}) },
			chat_scoped_char_memory: {},
			chat_log: insultRequestContext,
			extension: { platform: platformAPI.name, chat_id: defaultChannel.id, is_direct_message: false }
		}

		let insultMessageContent = '？'
		try {
			const aiInsultReply = await GentianAphrodite.interfaces.chat.GetReply(insultRequest)
			if (aiInsultReply && aiInsultReply.content)
				insultMessageContent = aiInsultReply.content
			else
				console.warn('[BotLogic] AI did not generate insult content, using default.')
		} catch (e) {
			console.error(`[BotLogic] AI insult generation failed for group ${group.id}:`, e)
		}

		if (platformAPI.sendMessage && insultMessageContent)
			try {
				await platformAPI.sendMessage(defaultChannel.id, { content: insultMessageContent })
			} catch (e) {
				console.error(`[BotLogic] Failed to send insult to group ${group.id}:`, e)
			}

		if (platformAPI.leaveGroup)
			await platformAPI.leaveGroup(group.id)
		else
			console.warn(`[BotLogic] leaveGroup not implemented for ${platformAPI.name}. Cannot leave group ${group.id}.`)
	} catch (error) {
		console.error(`[BotLogic] Error in handleGroupCheck for group ${group.id} on ${platformAPI.name}:`, error)
	}
}

/**
 * 注册平台 API 实例。
 * @param {PlatformAPI_t} platformAPI - 要注册的平台 API 实例。
 */
export async function registerPlatformAPI(platformAPI) {
	if (!platformAPI) {
		console.error('[BotLogic] Attempted to register an invalid platform API.')
		return
	}

	if (platformAPI.onGroupJoin)
		platformAPI.onGroupJoin(async (group) => {
			await handleGroupCheck(group, platformAPI)
		})
	else
		console.warn(`[BotLogic] onGroupJoin not implemented for platform: ${platformAPI.name}`)

	let usedOptimizedCheck = false
	if (platformAPI.getOwnerPresenceInGroups)
		try {
			const presenceResult = await platformAPI.getOwnerPresenceInGroups()
			if (presenceResult) {
				if (presenceResult.groupsWithoutOwner.length > 0)
					for (const group of presenceResult.groupsWithoutOwner) {
						await new Promise(resolve => setTimeout(resolve, 2000))
						await handleGroupCheck(group, platformAPI)
					}

				usedOptimizedCheck = true
			} else
				console.warn(`[BotLogic] Optimized owner presence check returned null for ${platformAPI.name}. Falling back if alternative is available.`)

		} catch (e) {
			console.error(`[BotLogic] Error calling getOwnerPresenceInGroups for ${platformAPI.name}:`, e)
		}


	if (!usedOptimizedCheck && platformAPI.getJoinedGroups)
		try {
			const allGroups = await platformAPI.getJoinedGroups()
			if (allGroups && allGroups.length > 0)
				for (const group of allGroups) {
					await new Promise(resolve => setTimeout(resolve, 2000))
					await handleGroupCheck(group, platformAPI)
				}

		} catch (e) {
			console.error(`[BotLogic] Error fetching joined groups for ${platformAPI.name} fallback check:`, e)
		}
	else if (!usedOptimizedCheck)
		console.log(`[BotLogic] No group checking mechanism available for ${platformAPI.name} at startup (Neither getOwnerPresenceInGroups nor getJoinedGroups are fully supported/implemented).`)

	if (platformAPI.onOwnerLeaveGroup)
		platformAPI.onOwnerLeaveGroup(async (groupId, leftUserId) => {
			const ownerIdForPlatform = platformAPI.getOwnerUserId?.()
			if (ownerIdForPlatform && String(leftUserId) === String(ownerIdForPlatform))
				try {
					await platformAPI.leaveGroup?.(groupId)
				} catch (e) {
					console.error(`[BotLogic] Error leaving group ${groupId} after owner departure on ${platformAPI.name}: `, e)
				}

		})
	else
		console.warn(`[BotLogic] onOwnerLeaveGroup not implemented for platform: ${platformAPI.name}.`)
}
