import { Buffer } from 'node:buffer'
import { charname as BotCharname, username as FountUsername, is_dist } from '../charbase.mjs'
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
	let lastEntry = { ...logEntries[0], extension: { ...logEntries[0].extension, platform_message_ids: [...logEntries[0].extension?.platform_message_ids || []] } }

	for (let i = 1; i < logEntries.length; i++) {
		const currentEntry = logEntries[i]
		if (
			lastEntry.name === currentEntry.name &&
			currentEntry.time_stamp - lastEntry.time_stamp < currentConfig.MergeMessagePeriodMs &&
			(lastEntry.files || []).length === 0
		) {
			lastEntry.content += '\n' + currentEntry.content
			lastEntry.files = currentEntry.files
			lastEntry.time_stamp = currentEntry.time_stamp
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
			lastEntry = { ...currentEntry, extension: { ...currentEntry.extension, platform_message_ids: [...currentEntry.extension?.platform_message_ids || []] } }
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
 * @param {{has_other_gentian_bot?: boolean}} [env={}] - 环境信息对象，例如是否检测到其他机器人。
 * @returns {Promise<boolean>} 如果应该回复则返回 true，否则返回 false。
 */
async function checkMessageTrigger(fountEntry, platformAPI, channelId, env = {}) {
	const content = (fountEntry.content || '').trim().replace(/^@\S+(?:\s+@\S+)*\s*/, '')
	const isFromOwner = fountEntry.extension?.is_from_owner === true

	if (fountEntry.extension?.is_direct_message) return isFromOwner
	if (inHypnosisChannelId && inHypnosisChannelId === channelId && !isFromOwner) return false

	const { possibility, isMutedChannel, mentionedWithoutAt } = await calculateTriggerPossibility(fountEntry, platformAPI, channelId, content, env)

	if (isMutedChannel) return false // 检查在可能性计算期间频道是否被静音

	// 基于可能性分数做出最终决定
	const okey = Math.random() * 100 < possibility

	logTriggerCheckDetails(fountEntry, platformAPI, channelId, content, possibility, okey, isFromOwner, mentionedWithoutAt, env)

	return okey
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
	if (base_match_keys(content, ['老婆', '女票', '女朋友', '炮友'])) possible += 50
	if (base_match_keys(content, [/(有点|好)紧张/, '救救', '帮帮', /帮(我|(你|你家)?(主人|老公|丈夫|爸爸|宝宝))/, '来人', '咋用', '教教', /是真的(吗|么)/])) possible += 100
	if (base_match_keys(content, GentianWords) && base_match_keys(content, [/怎么(想|看)/])) possible += 100
	if (base_match_keys(content, ['睡了', '眠了', '晚安', '睡觉去了'])) possible += 50
	if (base_match_keys(content, ['失眠了', '睡不着'])) possible += 100
	if (base_match_keys(content, [/(?<!你)失眠(?!的)/, /(?<!别)(伤心|难受)/, '好疼'])) possible += 50
	if (base_match_keys(content, ['早上好', '早安'])) possible += 100

	if (isInFavor) {
		possible += 4
		const botUserId = platformAPI.getBotUserId()
		const currentChannelLog = channelChatLogs[channelId] || []
		const lastBotMsgIndex = currentChannelLog.findLastIndex(log => log.extension?.platform_user_id == botUserId)
		const messagesSinceLastBotReply = lastBotMsgIndex === -1 ? currentChannelLog.length : currentChannelLog.slice(lastBotMsgIndex + 1).length
		if (base_match_keys(content, [
			/(再|多)(来|表演)(点|.*(次|个))/, '来个', '不够', '不如', '继续', '确认', '执行',
			/^(那|所以你|可以再|你?再(讲|说|试试|猜)|你(觉得|想|知道|确定|试试)|但是|我?是说)/, /^so/i,
		]) && messagesSinceLastBotReply <= 3)
			possible += 100

	}
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
	} else if (fountEntry.extension?.mentions_bot) {
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

	const isChineseNamePattern = base_match_keys(contentEdgesForChineseCheck, ['龙胆'])
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

	possible += base_match_keys(content, fountEntry.extension.OwnerNameKeywords) * 7
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

	} else { // 非主人消息
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
}

/**
 * 准备 AI 回复请求所需的数据。
 * @async
 * @param {chatLogEntry_t_ext} triggerMessage - 触发本次回复的原始消息条目。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {string | number} channelId - 消息所在的频道 ID。
 * @returns {Promise<object>} 包含回复请求所需数据的对象。
 */
async function prepareReplyRequestData(triggerMessage, platformAPI, channelId) {
	const currentChannelChatLog = channelChatLogs[channelId] || []
	channelCharScopedMemory[channelId] ??= {} // 确保记忆对象存在

	const activePlugins = platformAPI.getPlatformSpecificPlugins(triggerMessage) || {}
	const platformWorld = platformAPI.getPlatformWorld() || null
	const chatNameForAI = platformAPI.getChatNameForAI(channelId, triggerMessage)
	const fountBotDisplayName = (await GentianAphrodite.getPartInfo?.(localhostLocales[0]))?.name || BotCharname
	const botNameForAIChat = userIdToNameMap[platformAPI.getBotUserId()] || `${platformAPI.getBotUsername()} (咱自己)` || `${fountBotDisplayName} (咱自己)`
	const ownerPlatformUsername = platformAPI.getOwnerUserName()
	const ownerPlatformId = platformAPI.getOwnerUserId()
	const replyToCharName = userIdToNameMap[triggerMessage.extension?.platform_user_id || ''] || triggerMessage.name
	const userCharNameForAI = triggerMessage.extension.is_from_owner ? replyToCharName : userIdToNameMap[ownerPlatformId] || ownerPlatformUsername

	return {
		currentChannelChatLog,
		activePlugins,
		platformWorld,
		chatNameForAI,
		botNameForAIChat,
		userCharNameForAI,
		replyToCharName,
	}
}

/**
 * 构建 AI 回复请求对象。
 * @param {chatLogEntry_t_ext} triggerMessage - 触发消息。
 * @param {PlatformAPI_t} platformAPI - 平台 API。
 * @param {string | number} channelId - 频道 ID。
 * @param {object} requestData - `prepareReplyRequestData` 返回的数据。
 * @returns {FountChatReplyRequest_t} 构建好的回复请求对象。
 */
function buildReplyRequest(triggerMessage, platformAPI, channelId, requestData) {
	const {
		currentChannelChatLog,
		activePlugins,
		platformWorld,
		chatNameForAI,
		botNameForAIChat,
		userCharNameForAI,
		replyToCharName,
	} = requestData

	return {
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
			updatedRequest.chat_log = channelChatLogs[channelId] || [] // 刷新日志
			updatedRequest.chat_scoped_char_memory = channelCharScopedMemory[channelId] // 刷新记忆
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
}

/**
 * 处理 AI 的最终回复。
 * @async
 * @param {FountChatReply_t | null} aiFinalReply - AI 的回复。
 * @param {PlatformAPI_t} platformAPI - 平台 API。
 * @param {string | number} channelId - 频道 ID。
 * @param {chatLogEntry_t_ext} triggerMessage - 原始触发消息。
 */
async function processAIReply(aiFinalReply, platformAPI, channelId, triggerMessage) {
	if (channelCharScopedMemory[channelId]?.in_hypnosis)
		inHypnosisChannelId = channelId
	else
		inHypnosisChannelId = null


	if (!aiFinalReply)
		return


	for (const bannedStr of bannedStrings)
		if (aiFinalReply.content)
			aiFinalReply.content = aiFinalReply.content.replaceAll(bannedStr, '')



	if (aiFinalReply.content || aiFinalReply.files?.length)
		await sendAndLogReply(aiFinalReply, platformAPI, channelId, aiFinalReply.extension?.replied_to_message_id ? undefined : triggerMessage)

}

/**
 * 执行核心的回复生成逻辑，包括调用 AI 和处理结果。
 * @async
 * @param {chatLogEntry_t_ext} triggerMessage - 触发本次回复的原始消息条目。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {string | number} channelId - 消息所在的频道 ID。
 */
async function doMessageReplyInternal(triggerMessage, platformAPI, channelId) {
	let typingInterval = setInterval(() => { platformAPI.sendTyping(channelId).catch(() => { }) }, 5000)
	function clearTypingInterval() {
		if (typingInterval) typingInterval = clearInterval(typingInterval)
	}

	updateBotNameMapping(platformAPI)

	try {
		const requestData = await prepareReplyRequestData(triggerMessage, platformAPI, channelId)
		const replyRequest = buildReplyRequest(triggerMessage, platformAPI, channelId, requestData)
		const aiFinalReply = fuyanMode ? { content: '嗯嗯！' } : await GentianAphrodite.interfaces.chat.GetReply(replyRequest)
		await processAIReply(aiFinalReply, platformAPI, channelId, triggerMessage)
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
	if (!replyToSend.content && !replyToSend.files?.length) {
		console.warn('[BotLogic] sendAndLogReply: Attempted to send empty message, skipped.', replyToSend)
		return null
	}

	const result = await platformAPI.sendMessage(channelId, replyToSend, repliedToMessageEntry)
	if (result) {
		channelLastSendMessageTime[channelId] = result.time_stamp
		channelChatLogs[channelId].push(result)
	}
	return result
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

	await initializeChannelLogIfEmpty(channelId, platformAPI)

	const myQueue = channelMessageQueues[channelId]
	const currentChannelLog = channelChatLogs[channelId]

	try {
		while (myQueue.length > 0) {
			const exitSignal = await processNextMessageInQueue(myQueue, currentChannelLog, platformAPI, channelId)
			if (exitSignal === 'exit') return
		}
	} catch (error) {
		const contextMessage = myQueue.length > 0 ? myQueue[myQueue.length - 1] : currentChannelLog?.slice(-1)[0]
		await handleError(error, platformAPI, contextMessage)
	} finally {
		if (channelMessageQueues[channelId]?.length === 0)
			delete channelHandlers[channelId]
	}
}

/**
 * 初始化频道日志（如果为空）。
 * @async
 * @param {string | number} channelId - 频道 ID。
 * @param {PlatformAPI_t} platformAPI - 平台 API。
 */
async function initializeChannelLogIfEmpty(channelId, platformAPI) {
	if (!channelChatLogs[channelId] || channelChatLogs[channelId].length === 0) {
		const historicalMessages = await platformAPI.fetchChannelHistory(channelId, currentConfig.DefaultMaxFetchCount)
		const mergedHistoricalLog = mergeChatLogEntries(historicalMessages.sort((a, b) => a.time_stamp - b.time_stamp).slice(0, -1))
		channelChatLogs[channelId] = mergedHistoricalLog
		while (channelChatLogs[channelId].length > currentConfig.DefaultMaxMessageDepth)
			channelChatLogs[channelId].shift()

	}
}

/**
 * 处理消息队列中的下一条消息（包括合并和触发检查）。
 * @async
 * @param {chatLogEntry_t_ext[]} myQueue - 当前频道的消息队列。
 * @param {chatLogEntry_t_ext[]} currentChannelLog - 当前频道的聊天记录。
 * @param {PlatformAPI_t} platformAPI - 平台 API。
 * @param {string | number} channelId - 频道 ID。
 * @returns {Promise<'exit' | undefined>} 如果需要退出处理则返回 'exit'。
 */
async function processNextMessageInQueue(myQueue, currentChannelLog, platformAPI, channelId) {
	let currentMessageToProcess = myQueue[0]
	if (!currentMessageToProcess) {
		myQueue.shift()
		return
	}

	const lastLogEntry = currentChannelLog.length > 0 ? currentChannelLog[currentChannelLog.length - 1] : null
	let triggered = false

	if (!isMessageMergeable(lastLogEntry, currentMessageToProcess)) {
		currentChannelLog.push(currentMessageToProcess)
		myQueue.shift()
		const triggerResult = await checkQueueMessageTrigger(currentMessageToProcess, currentChannelLog, platformAPI, channelId)
		if (triggerResult === 'exit') return 'exit'
		if (triggerResult === 1) triggered = true
	} else {
		const actualLastLogEntry = lastLogEntry
		do {
			const triggerResultForCurrent = await checkQueueMessageTrigger(currentMessageToProcess, currentChannelLog, platformAPI, channelId)

			actualLastLogEntry.content = (actualLastLogEntry.extension.content_parts || [actualLastLogEntry.content])
				.concat(currentMessageToProcess.extension.content_parts || [currentMessageToProcess.content])
				.join('\n')
			actualLastLogEntry.files = currentMessageToProcess.files
			actualLastLogEntry.time_stamp = currentMessageToProcess.time_stamp
			actualLastLogEntry.extension = {
				...actualLastLogEntry.extension,
				...currentMessageToProcess.extension,
				platform_message_ids: Array.from(new Set([
					...actualLastLogEntry.extension.platform_message_ids || [],
					...currentMessageToProcess.extension.platform_message_ids || []
				])),
				content_parts: (actualLastLogEntry.extension.content_parts || [actualLastLogEntry.content.split('\n').pop()])
					.concat(currentMessageToProcess.extension.content_parts || [currentMessageToProcess.content]),
				SimplifiedContents: undefined,
			}
			myQueue.shift()

			if (triggerResultForCurrent === 'exit') return 'exit'
			if (triggerResultForCurrent === 1) triggered = true

			currentMessageToProcess = myQueue[0]
		} while (currentMessageToProcess && isMessageMergeable(actualLastLogEntry, currentMessageToProcess))
	}

	while (currentChannelLog.length > currentConfig.DefaultMaxMessageDepth)
		currentChannelLog.shift()


	const messageForReply = triggered ? currentChannelLog[currentChannelLog.length - 1] : null
	if (messageForReply)
		await doMessageReplyInternal(messageForReply, platformAPI, channelId)
}

/**
 * 为错误生成 AI 建议。
 * @async
 * @param {Error} error - 发生的错误对象。
 * @param {string} errorMessageForRecord - 格式化后的错误消息，用于记录和 AI 输入。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {chatLogEntry_t_ext | undefined} contextMessage - (可选) 发生错误时的上下文消息条目。
 * @returns {Promise<FountChatReply_t | null>} AI 生成的回复建议，或在无法生成时返回 null。
 */
async function getAISuggestionForError(error, errorMessageForRecord, platformAPI, contextMessage) {
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
				time_stamp: new Date().getTime(),
				role: 'char',
				extension: {}
			}, {
				name: ownerNameForAI,
				content: errorMessageForRecord + is_dist ? `\
龙胆，解释下这个错误是什么？可能该如何修复？
同时给我你的创作者的相关信息，方便我反馈。
`: `\
龙胆，我该如何解决这个错误？可以的话你来直接修复它。
注意的点：
- 以修正出问题的文件为主，宏观上没什么好修复的
- fount项目基于deno，没有package.json
- 不要删除整个项目并重新下载，那会删除你自己和我的用户配置
- 不能修复也没问题，帮我分析下报错也可以，不会怪你
`,
				time_stamp: new Date().getTime(),
				role: 'user',
				extension: {}
			}, {
				name: 'system',
				content: isInHypnosisForError ? '在回复时保持呆滞语气。' : '在回复问题时保持少女语气，适当添加语气词。',
				time_stamp: new Date().getTime(),
				role: 'system',
				extension: {}
			}
		]

		const chatNameForSelfRepair = platformAPI.getChatNameForAI(
			currentChannelId || is_dist ? 'error-report-context' : 'self-repair-context',
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
		return await GentianAphrodite.interfaces.chat.GetReply(selfRepairRequest)
	} catch (anotherError) {
		const anotherErrorStack = anotherError.stack || anotherError.message
		const currentChannelId = contextMessage?.extension?.platform_channel_id
		const isHypnosisContextForError = !!(inHypnosisChannelId && currentChannelId && currentChannelId === inHypnosisChannelId)

		if (`${error.name}: ${error.message}` === `${anotherError.name}: ${anotherError.message}`)
			return { content: isHypnosisContextForError ? '抱歉，洗脑母畜龙胆没有解决思路。' : '没什么解决思路呢？' }

		return { content: '```\n' + anotherErrorStack + '\n```\n' + (isHypnosisContextForError ? '抱歉，洗脑母畜龙胆没有解决思路。' : '没什么解决思路呢？') }
	}
}

/**
 * 发送错误报告。
 * @async
 * @param {string} fullReplyContent - 包含错误信息和 AI 建议的完整回复内容。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {Error} originalError - 原始错误对象。
 * @param {chatLogEntry_t_ext | undefined} contextMessage - (可选) 发生错误时的上下文消息条目。
 */
async function sendErrorReport(fullReplyContent, platformAPI, originalError, contextMessage) {
	try {
		if (contextMessage?.extension?.platform_channel_id)
			await sendAndLogReply({ content: fullReplyContent }, platformAPI, contextMessage.extension.platform_channel_id, undefined)
		else
			platformAPI.logError(new Error('[BotLogic] Error occurred (no context channel to reply): ' + fullReplyContent.substring(0, 1000) + '...'), undefined)

	} catch (sendError) {
		platformAPI.logError(sendError, contextMessage)
		console.error('[BotLogic] Failed to send error notification. Original error:', originalError, 'Send error:', sendError)
	}
}

/**
 * 检查消息是否可以合并到上一条消息。
 * @param {chatLogEntry_t_ext | null} lastLogEntry - 上一条日志条目。
 * @param {chatLogEntry_t_ext} currentMessageToProcess - 当前待处理的消息。
 * @returns {boolean} 如果可以合并则返回 true。
 */
function isMessageMergeable(lastLogEntry, currentMessageToProcess) {
	return lastLogEntry && currentMessageToProcess &&
		lastLogEntry.name === currentMessageToProcess.name &&
		currentMessageToProcess.time_stamp - lastLogEntry.time_stamp < currentConfig.MergeMessagePeriodMs &&
		(lastLogEntry.files || []).length === 0 &&
		(lastLogEntry.logContextAfter || []).length === 0 &&
		lastLogEntry.extension?.platform_message_ids &&
		currentMessageToProcess.extension?.platform_message_ids
}

/**
 * 在消息队列中处理主人的命令。
 * @async
 * @param {chatLogEntry_t_ext} currentMessageToProcess - 当前正在处理的消息。
 * @param {PlatformAPI_t} platformAPI - 平台 API。
 * @param {string | number} channelId - 频道 ID。
 * @returns {Promise<'exit' | 'handled' | undefined>} 如果命令需要终止处理则返回 'exit'，如果已处理则返回 'handled'。
 */
async function handleOwnerCommandsInQueue(currentMessageToProcess, platformAPI, channelId) {
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
				return 'exit' // 发出退出信号
			}
			const repeatMatch = content.match(/^龙胆.{0,2}复诵.{0,2}`(?<repeat_content>[\S\s]*)`$/)
			if (repeatMatch?.groups?.repeat_content) {
				await sendAndLogReply({ content: repeatMatch.groups.repeat_content }, platformAPI, channelId, currentMessageToProcess)
				newUserMessage(content, platformAPI.name)
				newCharReplay(repeatMatch.groups.repeat_content, platformAPI.name)
				return 'handled' // 命令已处理，无需进一步触发检查
			}
			const banWordMatch = content.match(/^龙胆.{0,2}禁止.{0,2}`(?<banned_content>[\S\s]*)`$/)
			if (banWordMatch?.groups?.banned_content)
				bannedStrings.push(banWordMatch.groups.banned_content)

			if (base_match_keys(content, [/^[\n,.~、。呵哦啊嗯噫欸胆龙，～]+$/, /^[\n,.~、。呵哦啊嗯噫欸胆龙，～]{4}[\n!,.?~、。呵哦啊嗯噫欸胆龙！，？～]+$/])) {
				const ownerCallReply = SimplifyChinese(content).replaceAll('龙', '主').replaceAll('胆', '人')
				await sendAndLogReply({ content: ownerCallReply }, platformAPI, channelId, currentMessageToProcess)
				newUserMessage(content, platformAPI.name)
				newCharReplay(ownerCallReply, platformAPI.name)
				return 'handled' // 命令已处理
			}
		}
	}
	return undefined // 没有处理主人命令或消息非来自主人
}

/**
 * 在消息队列处理中检查单个消息是否应触发回复或特殊操作。
 * @async
 * @param {chatLogEntry_t_ext} currentMessageToProcess - 当前正在处理的消息条目。
 * @param {chatLogEntry_t_ext[]} currentChannelLog - 当前频道的完整聊天记录。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {string | number} channelId - 消息所在的频道 ID。
 * @returns {Promise<number | 'exit' | 'handled' | undefined>} 1 表示触发回复, 'exit' 表示需要退出, 'handled' 表示已处理, undefined 表示无特殊操作。
 */
async function checkQueueMessageTrigger(currentMessageToProcess, currentChannelLog, platformAPI, channelId) {
	if (currentMessageToProcess.extension?.platform_user_id == platformAPI.getBotUserId())
		return // 不处理机器人自己的消息触发

	const ownerCommandResult = await handleOwnerCommandsInQueue(currentMessageToProcess, platformAPI, channelId)
	if (ownerCommandResult === 'exit' || ownerCommandResult === 'handled')
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
		return 1 // 应该触发回复
	else if (ownerBotOnlyInteraction && currentMessageToProcess.extension?.is_from_owner && !isMutedChannel)
		return 1 // 如果是主人在仅有主人和机器人的对话中发言，则触发
	else if (
		(!inHypnosisChannelId || channelId !== inHypnosisChannelId) &&
		!isMutedChannel &&
		currentMessageToProcess.extension?.platform_user_id != platformAPI.getBotUserId()
	) {
		// 复读检查
		const nameMap = {}
		function summary(message, name_diff = true) {
			let result = ''
			if (name_diff) {
				nameMap[message.name] ??= 0
				result += nameMap[message.name]++ + '\n'
			}
			result += (message.content ?? '') + '\n\n'
			result += (message.files || []).filter(file => !file.extension?.is_from_vision).map(file => file.buffer instanceof Buffer ? file.buffer.toString('hex') : String(file.buffer)).join('\n')
			return result
		}
		const repet = findMostFrequentElement(currentChannelLog.slice(-10), summary) // 检查最近10条消息
		if (
			(repet.element?.content || repet.element?.files?.length) &&
			repet.count >= currentConfig.RepetitionTriggerCount &&
			!base_match_keys(repet.element.content + '\n' + (repet.element.files || []).map(file => file.name).join('\n'), [...currentMessageToProcess.extension.OwnerNameKeywords || [], ...rude_words, ...GentianWords]) &&
			!isBotCommand(repet.element.content) &&
			!currentChannelLog.slice(-10).some(msg => msg.extension?.platform_user_id == platformAPI.getBotUserId() && summary(msg, false) === summary(repet.element, false))
		) {
			await sendAndLogReply(
				{ content: repet.element.content, files: repet.element.files.filter(file => !file.extension?.is_from_vision) },
				platformAPI, channelId, currentMessageToProcess
			)
			// 复读已发送，此消息不再触发通用回复
			return // 返回 undefined，因为复读是一种回复，但不是需要新 AI 响应的“触发”
		}
	}
	return undefined // 此函数无特定触发操作
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

	const aiSuggestionReply = await getAISuggestionForError(error, errorMessageForRecord, platformAPI, contextMessage)

	let fullReplyContent = errorMessageForRecord + '\n' + (aiSuggestionReply?.content || '')
	const randomIPDict = {}
	fullReplyContent = fullReplyContent.replace(/(?:\d{1,3}\.){3}\d{1,3}/g, ip => randomIPDict[ip] ??= Array(4).fill(0).map(() => Math.floor(Math.random() * 255)).join('.'))

	await sendErrorReport(fullReplyContent, platformAPI, error, contextMessage)

	platformAPI.logError(error, contextMessage)
	console.error('[BotLogic] Original error handled:', error, 'Context:', contextMessage)
	await reloadPart(FountUsername, 'chars', BotCharname)
}

/**
 * 更新用户缓存（ID到名称和名称到ID的映射）。
 * @param {string | number | undefined} senderId - 发送者 ID。
 * @param {string | undefined} senderName - 发送者名称。
 */
function updateUserCache(senderId, senderName) {
	if (senderId && senderName) {
		if (!userIdToNameMap[senderId] || userIdToNameMap[senderId] !== senderName)
			userIdToNameMap[senderId] = senderName

		if (!nameToUserIdMap[senderName] || nameToUserIdMap[senderName] !== senderId)
			nameToUserIdMap[senderName] = senderId

	}
}

/**
 * 确保指定频道的处理器正在运行。
 * @param {string | number} channelId - 频道 ID。
 * @param {PlatformAPI_t} platformAPI - 平台 API。
 * @param {chatLogEntry_t_ext} fountEntry - 当前消息条目 (用于错误处理上下文)。
 */
function ensureChannelHandlerIsRunning(channelId, platformAPI, fountEntry) {
	if (!channelHandlers[channelId])
		channelHandlers[channelId] = handleMessageQueue(channelId, platformAPI)
			.catch(err => {
				handleError(err, platformAPI, fountEntry)
			})
			.finally(() => {
				if (channelMessageQueues[channelId]?.length === 0)
					delete channelHandlers[channelId]
				else if (!channelHandlers[channelId])
					console.warn(`[BotLogic] Channel handler for ${channelId} was cleared, but queue is not empty. Not auto-restarting immediately.`)
			})
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
		updateUserCache(fountEntry.extension?.platform_user_id, fountEntry.name)

		channelMessageQueues[channelId] ??= []
		channelMessageQueues[channelId].push(fountEntry)

		ensureChannelHandlerIsRunning(channelId, platformAPI, fountEntry)
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
			entryToUpdate.time_stamp = updatedFountEntry.time_stamp
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
 * 检查群组中是否存在主人。
 * @async
 * @param {import('./index.mjs').GroupObject} group - 要检查的群组。
 * @param {import('./index.mjs').PlatformAPI_t} platformAPI - 平台 API 实例。
 * @param {string | number | null} ownerOverride - (可选) 测试用的主人用户 ID 覆盖。
 * @returns {Promise<boolean>} 如果主人存在则返回 true，否则返回 false。
 */
async function checkOwnerPresence(group, platformAPI, ownerOverride = null) {
	const ownerIdToCompare = ownerOverride || platformAPI.getOwnerUserId?.()
	const ownerUsernameToCompare = platformAPI.getOwnerUserName?.()

	if (platformAPI.getGroupMembers) {
		const members = await platformAPI.getGroupMembers(group.id)
		if (members)
			return members.some(member =>
				String(member.id) === String(ownerIdToCompare) ||
				(member.username && ownerUsernameToCompare && member.username.toLowerCase() === ownerUsernameToCompare.toLowerCase())
			)

		console.warn(`[BotLogic] Could not retrieve members for group ${group.id} on ${platformAPI.name}. Skipping owner check.`)
	} else
		console.warn(`[BotLogic] getGroupMembers not implemented for platform ${platformAPI.name}. Cannot check owner presence in group ${group.id}. Skipping.`)

	return false // 如果检查失败，默认主人不存在
}

/**
 * 生成 AI 侮辱消息。
 * @async
 * @param {import('./index.mjs').GroupObject} group - 目标群组。
 * @param {import('./index.mjs').PlatformAPI_t} platformAPI - 平台 API 实例。
 * @param {import('./index.mjs').ChannelObject} defaultChannel - 群组的默认频道。
 * @param {chatLogEntry_t_ext[]} channelHistoryForAI - 用于 AI 上下文的频道历史记录。
 * @returns {Promise<string>} AI 生成的侮辱消息内容。
 */
async function generateInsult(group, platformAPI, defaultChannel, channelHistoryForAI) {
	const groupNameForAI = group.name || `Group ${group.id}`
	const insultRequestContext = [
		...channelHistoryForAI,
		{
			name: 'system',
			role: 'system',
			time_stamp: Date.now(),
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
		plugins: { ...platformAPI.getPlatformSpecificPlugins?.({ extension: { platform_guild_id: group.id, platform_channel_id: defaultChannel.id, platform: platformAPI.name } }) },
		chat_scoped_char_memory: {},
		chat_log: insultRequestContext,
		extension: { platform: platformAPI.name, chat_id: defaultChannel.id, is_direct_message: false }
	}

	try {
		const aiInsultReply = await GentianAphrodite.interfaces.chat.GetReply(insultRequest)
		if (aiInsultReply && aiInsultReply.content)
			return aiInsultReply.content

		console.warn('[BotLogic] AI did not generate insult content, using default.')
	} catch (e) {
		console.error(`[BotLogic] AI insult generation failed for group ${group.id}:`, e)
	}
	return '？' // 默认侮辱内容
}

/**
 * 向主人发送邀请通知。
 * @async
 * @param {import('./index.mjs').GroupObject} group - 目标群组。
 * @param {import('./index.mjs').PlatformAPI_t} platformAPI - 平台 API。
 * @param {import('./index.mjs').ChannelObject} defaultChannel - 群组的默认频道。
 * @param {string | Error | null} inviteLink - 生成的邀请链接或错误对象。
 */
async function sendOwnerInviteNotifications(group, platformAPI, defaultChannel, inviteLink) {
	if (inviteLink && !(inviteLink instanceof Error)) {
		const inviteMessage = `咱被拉入了一个您不在的群组（已经退啦！）: \`${group.name}\` (ID: \`${group.id}\`)
链接: ${inviteLink}`
		if (platformAPI.sendDirectMessageToOwner)
			await platformAPI.sendDirectMessageToOwner(inviteMessage)
		else
			console.warn(`[BotLogic] sendDirectMessageToOwner not implemented for ${platformAPI.name}.`)


		const ownerPresenceResult = await platformAPI.getOwnerPresenceInGroups?.()
		const ownerUsernameToCompare = platformAPI.getOwnerUserName?.()
		if (ownerPresenceResult?.groupsWithOwner?.length > 0)
			ownerPresenceResult.groupsWithOwner.forEach(async otherGroup => {
				if (otherGroup.id === group.id) return

				const otherGroupDefaultChannel = await platformAPI.getGroupDefaultChannel?.(otherGroup.id)
				if (otherGroupDefaultChannel && platformAPI.sendMessage)
					try {
						await platformAPI.sendMessage(otherGroupDefaultChannel.id, { content: `@${ownerUsernameToCompare} ` + inviteMessage })
					} catch (e) {
						console.error(`[BotLogic] Failed to send invite message to owner in group ${otherGroup.name}:`, e)
					}

			})

	} else
		console.warn(`[BotLogic] Could not generate or use invite link for group ${group.id}. InviteLink:`, inviteLink)

}

/**
 * 发送侮辱消息并离开群组。
 * @async
 * @param {import('./index.mjs').GroupObject} group - 目标群组。
 * @param {import('./index.mjs').PlatformAPI_t} platformAPI - 平台 API。
 * @param {import('./index.mjs').ChannelObject} defaultChannel - 群组的默认频道。
 */
async function sendInsultAndLeaveGroup(group, platformAPI, defaultChannel) {
	let channelHistoryForAI = []
	if (platformAPI.fetchChannelHistory)
		channelHistoryForAI = await platformAPI.fetchChannelHistory(defaultChannel.id, 10)


	const insultMessageContent = await generateInsult(group, platformAPI, defaultChannel, channelHistoryForAI)

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

}

/**
 * 处理主人不在群组中的情况。
 * @async
 * @param {import('./index.mjs').GroupObject} group - 目标群组。
 * @param {import('./index.mjs').PlatformAPI_t} platformAPI - 平台 API 实例。
 * @param {import('./index.mjs').ChannelObject} defaultChannel - 群组的默认频道。
 */
async function handleOwnerNotInGroup(group, platformAPI, defaultChannel) {
	console.log(`[BotLogic] Owner NOT found in group ${group.name} (ID: ${group.id}). Taking action...`)

	let inviteLink = null
	if (platformAPI.generateInviteLink)
		inviteLink = await platformAPI.generateInviteLink(group.id, defaultChannel.id)
			.catch(error => {
				console.error(`[BotLogic] Error generating invite link for group ${group.id}:`, error.stack)
				return error
			})
	else
		console.warn(`[BotLogic] generateInviteLink not implemented for ${platformAPI.name}.`)


	await sendOwnerInviteNotifications(group, platformAPI, defaultChannel, inviteLink)
	await sendInsultAndLeaveGroup(group, platformAPI, defaultChannel)
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
		const ownerIsPresent = await checkOwnerPresence(group, platformAPI, ownerOverride)
		if (ownerIsPresent) return

		const defaultChannel = await platformAPI.getGroupDefaultChannel?.(group.id)
		if (!defaultChannel) {
			console.warn(`[BotLogic] Could not find a default channel for group ${group.id}. Cannot send invite or message.`)
			// Still attempt to leave the group even if a default channel isn't found.
			if (platformAPI.leaveGroup)
				await platformAPI.leaveGroup(group.id)
			else
				console.warn(`[BotLogic] leaveGroup not implemented for ${platformAPI.name}. Cannot leave group ${group.id}.`)

			return
		}
		await handleOwnerNotInGroup(group, platformAPI, defaultChannel)
	} catch (error) {
		console.error(`[BotLogic] Error in handleGroupCheck for group ${group.id} on ${platformAPI.name}:`, error)
	}
}

/**
 * 设置群组加入时的处理器。
 * @param {PlatformAPI_t} platformAPI - 平台 API 实例。
 */
function setupOnGroupJoinHandler(platformAPI) {
	if (platformAPI.onGroupJoin)
		platformAPI.onGroupJoin(async (group) => {
			await handleGroupCheck(group, platformAPI)
		})
	else
		console.warn(`[BotLogic] onGroupJoin not implemented for platform: ${platformAPI.name}`)

}

/**
 * 执行初始的群组主人存在性检查。
 * @async
 * @param {PlatformAPI_t} platformAPI - 平台 API 实例。
 */
async function performInitialGroupOwnerCheck(platformAPI) {
	let usedOptimizedCheck = false
	if (platformAPI.getOwnerPresenceInGroups)
		try {
			const presenceResult = await platformAPI.getOwnerPresenceInGroups()
			if (presenceResult) {
				if (presenceResult.groupsWithoutOwner.length > 0)
					for (const group of presenceResult.groupsWithoutOwner) {
						await new Promise(resolve => setTimeout(resolve, 2000)) // 错开检查
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
					await new Promise(resolve => setTimeout(resolve, 2000)) // 错开检查
					await handleGroupCheck(group, platformAPI)
				}

		} catch (e) {
			console.error(`[BotLogic] Error fetching joined groups for ${platformAPI.name} fallback check:`, e)
		}
	else if (!usedOptimizedCheck)
		console.log(`[BotLogic] No group checking mechanism available for ${platformAPI.name} at startup (Neither getOwnerPresenceInGroups nor getJoinedGroups are fully supported/implemented).`)

}

/**
 * 设置主人离开群组时的处理器。
 * @param {PlatformAPI_t} platformAPI - 平台 API 实例。
 */
function setupOnOwnerLeaveGroupHandler(platformAPI) {
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

/**
 * 注册平台 API 实例。
 * @param {PlatformAPI_t} platformAPI - 要注册的平台 API 实例。
 */
export async function registerPlatformAPI(platformAPI) {
	if (!platformAPI) {
		console.error('[BotLogic] Attempted to register an invalid platform API.')
		return
	}

	setupOnGroupJoinHandler(platformAPI)
	await performInitialGroupOwnerCheck(platformAPI) // 启动时进行初始检查
	setupOnOwnerLeaveGroupHandler(platformAPI)
}
