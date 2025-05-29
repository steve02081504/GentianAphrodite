import { Buffer } from 'node:buffer'
// 假设你的角色基础信息和主API对象可以通过以下路径导入
// 请根据你的实际项目结构调整这些import路径
import { charname as BotCharname, username as FountUsername } from '../charbase.mjs'
import charAPI_obj from '../main.mjs' // 假设默认导出 charAPI 对象

import { base_match_keys, SimplifiyChinese } from '../scripts/match.mjs'
import { findMostFrequentElement } from '../scripts/tools.mjs'
import { rude_words } from '../scripts/dict.mjs'
import { localhostLocales } from '../../../../../../src/scripts/i18n.mjs' // Fount 核心库路径
import { newCharReplay, newUserMessage } from '../scripts/statistics.mjs'
import { reloadPart } from '../../../../../../src/server/managers/index.mjs'

/**
 * Fount 角色 API 对象类型。
 * @typedef {import('../../../../../src/decl/charAPI.ts').charAPI_t} charAPI_t_imported
 */
const charAPI = /** @type {charAPI_t_imported} */ charAPI_obj


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
 *      platform: string, // 平台名称 (例如, 'discord', 'telegram')
 *      OwnerNameKeywords: string[], // 主人名称关键词数组 (用于匹配提及主人)
 *      platform_message_ids?: any[], // 原始平台消息ID数组 (因为一条Fount消息可能对应多条平台消息)
 *      platform_channel_id?: string | number, // 原始平台频道ID
 *      platform_user_id?: string | number, // 原始平台用户ID
 *      platform_guild_id?: string, // 原始平台服务器/群组ID (可选)
 *      mentions_bot?: boolean, // 消息是否提及了机器人
 *      mentions_owner?: boolean, // 消息是否提及了配置的“主人”
 *      is_direct_message?: boolean, // 消息是否为私聊消息
 *      is_from_owner?: boolean, // 消息是否来自配置的“主人” (由接入层判断)
 *      [key: string]: any // 其他平台特定扩展字段
 *  }
 * }} chatLogEntry_t_ext
 */

/**
 * Represents a generic group or guild object.
 * @typedef {{
 *  id: string | number; // Unique ID of the group/guild
 *  name: string;        // Name of the group/guild
 *  [key: string]: any;  // Allow platform-specific extensions
 * }} GroupObject
 */

/**
 * Represents a generic user object.
 * @typedef {{
 *  id: string | number; // Unique ID of the user
 *  username: string;    // Username of the user
 *  isBot?: boolean;     // Optional: flag if the user is a bot
 *  [key: string]: any;  // Allow platform-specific extensions
 * }} UserObject
 */

/**
 * Represents a generic channel object.
 * @typedef {{
 *  id: string | number; // Unique ID of the channel
 *  name: string;        // Name of the channel
 *  type?: string;       // Optional: type of channel (e.g., 'text', 'voice')
 *  [key: string]: any;  // Allow platform-specific extensions
 * }} ChannelObject
 */

/**
 * 平台接口 API 对象类型定义。
 * 这是 Bot 逻辑层调用接入层功能的规范。
 * @typedef {{
 *  name: string, // 平台名称 (例如, 'discord', 'telegram')
 *  sendMessage: (channelId: string | number, reply: FountChatReply_t, originalMessageEntry?: chatLogEntry_t_ext) => Promise<chatLogEntry_t_ext | null>, // 发送消息到指定频道
 *  sendTyping: (channelId: string | number) => Promise<void>, // 发送“正在输入”状态
 *  fetchChannelHistory: (channelId: string | number, limit: number) => Promise<chatLogEntry_t_ext[]>, // 获取频道历史消息
 *  getBotUserId: () => string | number, // 获取机器人自身的平台用户ID
 *  getBotUsername: () => string, // 获取机器人自身的平台原始用户名 (如 Gentian)
 *  getBotDisplayName: () => string, // 获取机器人自身的平台显示名称/昵称 (如 龙胆)
 *  getOwnerUserName: () => string, // 获取主人的平台原始用户名
 *  getOwnerUserId: () => string | number, // 获取主人的平台用户ID
 *  getChatNameForAI: (channelId: string | number, triggerMessage?: chatLogEntry_t_ext) => string, // 获取供AI使用的、易读的聊天/频道名称
 *  destroySelf: () => Promise<void>, // 通知接入层执行机器人销毁/下线操作
 *  logError: (error: Error, contextMessage?: chatLogEntry_t_ext) => void, // 记录错误到平台日志或控制台
 *  getPlatformSpecificPlugins: (messageEntry: chatLogEntry_t_ext) => Record<string, pluginAPI_t>, // 获取特定于该平台和消息上下文的插件
 *  getPlatformWorld: () => WorldAPI_t, // 获取特定于该平台的世界观配置
 *  splitReplyText: (text: string) => string[], // 根据平台限制分割长文本回复
 *  config: Record<string, any>, // 接入层自身的配置对象，例如包含 OwnerUserID, OwnerUserName 等
 *  onGroupJoin?: (onJoinCallback: (group: GroupObject) => Promise<void>) => void, // (Optional) Sets a callback function to be invoked when the bot joins a new group/guild.
 *  getJoinedGroups?: () => Promise<GroupObject[]>, // (Optional) Fetches a list of all groups/guilds the bot is currently a member of.
 *  getGroupMembers?: (groupId: string | number) => Promise<UserObject[]>, // (Optional) Fetches a list of members for a specific group/guild.
 *  generateInviteLink?: (groupId: string | number, channelId?: string | number) => Promise<string | null>, // (Optional) Generates an invite link for the specified group/guild.
 *  leaveGroup?: (groupId: string | number) => Promise<void>, // (Optional) Makes the bot leave the specified group/guild.
 *  getGroupDefaultChannel?: (groupId: string | number) => Promise<ChannelObject | null>, // (Optional) Gets the default or a suitable primary channel for a group/guild.
 *  sendDirectMessageToOwner?: (message: string) => Promise<void> // (Optional) Sends a direct message (DM) to the configured bot owner.
 * }} PlatformAPI_t
 */

/**
 * Bot 逻辑层配置对象类型定义。
 * 这些配置通常由接入层在初始化时提供，或使用默认值。
 * @typedef {{
 *  DefaultMaxMessageDepth?: number, // 默认维护的聊天记录深度
 *  DefaultMaxFetchCount?: number, // 默认初次获取历史记录的条数
 *  BaseTriggerChanceToOwner?: number, // 对主人消息的基础回复概率加成 (百分比)
 *  RepetitionTriggerCount?: number, // 触发复读的重复消息计数
 *  MuteDurationMs?: number, // 触发闭嘴后的静默时长 (毫秒)
 *  InteractionFavorPeriodMs?: number, // 判定为“偏爱期”（短时连续对话）的时间窗口 (毫秒)
 *  MergeMessagePeriodMs?: number, // 合并同一用户连续短消息的时间窗口 (毫秒)
 *  MinLogForOtherBotCheck?: number, // 判断是否存在其他同名机器人所需的最小近期日志条数
 * }} BotLogicConfig_t
 */

// --- 模块级状态存储 ---

/**
 * @type {PlatformAPI_t[]}
 */
const registeredPlatformAPIs = [];

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
 * 主要用于机器人自身名称的规范化。
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

// --- 模块级配置 ---
/**
 * 当前 Bot 逻辑层的配置。
 * @type {BotLogicConfig_t}
 */
let currentConfig = {
	DefaultMaxMessageDepth: 20,
	DefaultMaxFetchCount: 30, // 旧逻辑是 MAX_MESSAGE_DEPTH * 3 / 2
	BaseTriggerChanceToOwner: 7,
	RepetitionTriggerCount: 4,
	MuteDurationMs: 3 * 60 * 1000,
	InteractionFavorPeriodMs: 3 * 60 * 1000,
	MergeMessagePeriodMs: 3 * 60 * 1000,
	MinLogForOtherBotCheck: 5,
}

const GentianWords = ['龙胆', 'gentian'] // 这个配置用于通用的机器人名提及

/**
 * 配置 Bot 逻辑层。
 * 此函数应在应用启动时由主控制逻辑或接入层调用一次，以覆盖默认配置。
 * @param {Partial<BotLogicConfig_t>} newConfig - 一个包含部分或全部新配置项的对象。
 */
export function configure(newConfig) {
	currentConfig = { ...currentConfig, ...newConfig }
	if (currentConfig.DefaultMaxMessageDepth && (!newConfig.DefaultMaxFetchCount || newConfig.DefaultMaxFetchCount < currentConfig.DefaultMaxMessageDepth))
		currentConfig.DefaultMaxFetchCount = Math.floor(currentConfig.DefaultMaxMessageDepth * 3 / 2) || currentConfig.DefaultMaxMessageDepth

	console.log('[BotLogic] Configured:', currentConfig)
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
		return false // 催眠模式下，非主人消息不回复


	let possible = 0

	// --- 提前计算 mentionedWithoutAt，因为它同时影响主人和非主人的逻辑 ---
	const EngWords = content.split(' ')
	const oldLogicChineseCheck = base_match_keys(
		content.substring(0, 5) + ' ' + content.substring(content.length - 5),
		['龙胆'] // 旧逻辑中硬编码的中文关键词
	)
	const oldLogicEnglishCheck = base_match_keys(
		EngWords.slice(0, 6).concat(EngWords.slice(-3)).join(' '),
		['gentian'] // 旧逻辑中硬编码的英文关键词
	)
	const nameMentionedByOldLogic = oldLogicChineseCheck || oldLogicEnglishCheck

	const mentionedWithoutAt = !env.has_other_gentian_bot &&
		nameMentionedByOldLogic &&
		!base_match_keys(content, [/(龙胆(有|能|这边|目前|[^ 。你，]{0,3}的)|gentian('s|is|are|can|has))/i]) &&
		!base_match_keys(content, [/^.{0,4}龙胆$/i])
	// --- mentionedWithoutAt 计算结束 ---

	possible += base_match_keys(content, fountEntry.extension.OwnerNameKeywords) * 7
	possible += base_match_keys(content, GentianWords) * 5 // 通用机器人名提及
	possible += base_match_keys(content, [/(花|华)(萝|箩|罗)(蘑|磨|摩)/g]) * 3

	const isBotCommandLike = !!content.match(/^[!$%&/\\！]/)

	const timeSinceLastBotMessageInChannel = fountEntry.timeStamp - (channelLastSendMessageTime[channelId] || 0)
	const isInFavor = timeSinceLastBotMessageInChannel < currentConfig.InteractionFavorPeriodMs

	let isMutedChannel = (Date.now() - (channelMuteStartTimes[channelId] || 0)) < currentConfig.MuteDurationMs

	if (isFromOwner) {
		// 旧: if (mentionedWithoutAt || message.mentions.users.has(client.user.id))
		if (mentionedWithoutAt || fountEntry.extension?.mentions_bot) {
			possible += 100
			delete channelMuteStartTimes[channelId] // 主人@机器人或无@提及机器人，解除静默
			isMutedChannel = false
		}
		// 旧: if (inMute || (inFavor && base_match_keys(content, ['闭嘴', '安静', '肃静']) && content.length < 10))
		if ((isMutedChannel || isInFavor) && base_match_keys(content, ['闭嘴', '安静', '肃静']) && content.length < 10) {
			channelMuteStartTimes[channelId] = Date.now()
			isMutedChannel = true
			return false // 主人说闭嘴，直接不回 (新版优化，旧版是设置状态后在末尾判断)
		}

		if (base_match_keys(content, ['老婆', '女票', '女朋友', '炮友'])) possible += 50
		if (base_match_keys(content, [/(有点|好)紧张/, '救救', '帮帮', /帮(我|(你|你家)?(主人|老公|丈夫|爸爸|宝宝))/, '来人', '咋用', '教教', /是真的(吗|么)/])) possible += 100
		if (base_match_keys(content, GentianWords) && base_match_keys(content, [/怎么(想|看)/])) possible += 100 // "龙胆你怎么看"
		if (base_match_keys(content, ['睡了', '眠了', '晚安', '睡觉去了'])) possible += 50
		if (base_match_keys(content, ['失眠了', '睡不着'])) possible += 100

		if (isInFavor) {
			possible += 4
			const currentChannelLog = channelChatLogs[channelId] || []
			const lastBotMsgIndex = currentChannelLog.findLastIndex(log => log.extension?.platform_user_id === botUserId)

			// --- 修复开始: 正确计算机器人上次回复后的消息总数 (任何发送者)，以匹配旧版逻辑 ---
			// 旧逻辑: new_chat_logs.length (机器人上次发言后的所有消息条数)
			const messagesSinceLastBotReply = lastBotMsgIndex === -1
				? currentChannelLog.length // 如果机器人从未发言，则计算所有消息
				: currentChannelLog.slice(lastBotMsgIndex + 1).length // 计算机器人上次回复后的所有消息
			// --- 修复结束 ---

			if (base_match_keys(content, [
				/(再|多)(来|表演)(点|.*(次|个))/, '来个', '不够', '不如', '继续', '确认', '执行',
				/^(那|所以你|可以再|你?再(讲|说|试试|猜)|你(觉得|想|知道|确定|试试)|但是|我?是说)/, /^so/i,
			]) && messagesSinceLastBotReply <= 3)  // 使用修正后的计数，旧逻辑是 !(new_chat_logs.length > 3) 即 <=3
				possible += 100

		}
		// 旧: if (message.mentions.users.has(client.user.id)) possible += 100 (这部分效果被上面的 mentionedWithoutAt || mentions_bot 覆盖了)
		if (!isBotCommandLike) possible += currentConfig.BaseTriggerChanceToOwner
	}
	// 非主人逻辑
	else
		// 旧: else if (mentionedWithoutAt)
		if (mentionedWithoutAt) { // 注意这里是 else if 的效果，因为主人分支已处理
			if (isInFavor) possible += 90
			else possible += 40
			if (base_match_keys(content, [/[午安早晚]安/])) possible += 100
		}
		// 对于非主人，如果明确@了机器人 (mentions_bot)，也需要增加概率
		// 旧: if (message.mentions.users.has(client.user.id)) { ... } (独立于 mentionedWithoutAt 的判断)
		// 新版通过 else if 保证了在非主人、非 mentionedWithoutAt 的情况下，明确@机器人时应用此逻辑
		else if (fountEntry.extension?.mentions_bot) { // 明确的@提及，且不是主人
			possible += 40 // 基础提及增加
			if (base_match_keys(content, [/\?|？/, '怎么', '什么', '吗', /(大|小)还是/, /(还是|哪个)(大|小)/])) possible += 100
			if (base_match_keys(content, rude_words))
				if (fuyanMode) return false
				else possible += 100

			if (base_match_keys(content, ['你主人', '你的主人'])) possible += 100
		}


	// 通用提及主人逻辑 (对主人和非主人均适用)
	// 旧: if (message.mentions.users.some(user => user.username === config.OwnerUserName) || base_match_keys(content, config.OwnerNameKeywords))
	if (fountEntry.extension?.mentions_owner || base_match_keys(content, fountEntry.extension.OwnerNameKeywords)) {
		possible += 7
		if (base_match_keys(content, rude_words))
			if (fuyanMode) return false
			else return true // 提及主人还骂人，直接回复 (旧版逻辑)

	}

	// 最终静默检查
	if (isMutedChannel)
		return false
	else
		// 如果之前设置了静默，但现在不静默了（比如时间到了，或主人通过@机器人解除了）
		// 且当前消息不是再次触发静默的指令
		if (channelMuteStartTimes[channelId] && !base_match_keys(content, ['闭嘴', '安静', '肃静']))
			delete channelMuteStartTimes[channelId]


	const okey = Math.random() * 100 < possible
	console.dir({
		name: fountEntry.name,
		content,
		files: fountEntry.files,
		possible,
		okey,
		isFromOwner,
		isInFavor,
		mentionsBot: fountEntry.extension?.mentions_bot,
		mentionsOwner: fountEntry.extension?.mentions_owner,
		mentionedWithoutAt,
		hasOtherGentianBot: env.has_other_gentian_bot,
	})

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
	const clearTypingInterval = () => {
		if (typingInterval) clearInterval(typingInterval)
		typingInterval = null
	}

	updateBotNameMapping(platformAPI)

	try {
		const currentChannelChatLog = channelChatLogs[channelId] || []
		channelCharScopedMemory[channelId] ??= {}

		const activePlugins = platformAPI.getPlatformSpecificPlugins(triggerMessage) || {}
		const platformWorld = platformAPI.getPlatformWorld() || null

		const chatNameForAI = platformAPI.getChatNameForAI(channelId, triggerMessage)

		const fountBotDisplayName = (await charAPI.getPartInfo?.(localhostLocales[0]))?.name || BotCharname
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
			char: charAPI,
			other_chars: [],
			plugins: activePlugins,
			chat_summary: '',
			chat_scoped_char_memory: channelCharScopedMemory[channelId],
			chat_log: currentChannelChatLog,
			async AddChatLogEntry(replyFromChar) {
				if (replyFromChar && (replyFromChar.content || replyFromChar.files?.length))
					return await sendAndLogReply(replyFromChar, platformAPI, channelId, triggerMessage)

				return null
			},
			async Update() {
				const updatedRequest = { ...this }
				updatedRequest.chat_log = channelChatLogs[channelId] || [] // 获取最新的聊天记录
				updatedRequest.chat_scoped_char_memory = channelCharScopedMemory[channelId] // 获取最新的短期记忆
				updatedRequest.time = new Date() // 更新时间
				return updatedRequest
			},
			extension: {
				platform: platformAPI.name,
				trigger_message_id: triggerMessage.extension?.platform_message_ids?.[0],
				chat_id: channelId,
				user_id: triggerMessage.extension?.platform_user_id,
				...triggerMessage.extension // 传入触发消息的所有扩展信息
			}
		}

		const aiFinalReply = fuyanMode ? { content: '嗯嗯！' } : await charAPI.interfaces.chat.GetReply(replyRequest)

		// 更新催眠状态
		if (channelCharScopedMemory[channelId]?.in_hypnosis)
			inHypnosisChannelId = channelId
		else
			inHypnosisChannelId = null

		if (!aiFinalReply)
			return console.log('[BotLogic] AI reply is empty, skipping sending.', triggerMessage)

		// 过滤禁止词
		for (const bannedStr of bannedStrings)
			if (aiFinalReply.content) aiFinalReply.content = aiFinalReply.content.replaceAll(bannedStr, '')

		// 发送并记录最终的AI回复
		// 旧版逻辑中，GetReply 返回后会调用 replyHandler，里面会发送消息并更新 lastSendMessageTime
		// 新版在这里通过 AddChatLogEntry 的包装函数来发送，但最终的回复需要单独处理
		// 这里改为直接调用 sendAndLogReply 来发送最终回复
		if (aiFinalReply && (aiFinalReply.content || aiFinalReply.files?.length))
			await sendAndLogReply(aiFinalReply, platformAPI, channelId, aiFinalReply.extension?.replied_to_message_id ? undefined : triggerMessage) // 如果AI指定了回复对象，则使用AI指定的，否则回复触发消息
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
	// 检查是否需要将被回复的消息条目置空，以避免平台API错误地回复到队列中的上一条消息
	// (旧版 discord.js 的 message.reply() 行为)
	// 如果被回复的消息已经是日志的最后一条，并且消息队列为空 (意味着当前处理的是这条消息的直接回复)，则不传递 repliedToMessageEntry
	if (
		repliedToMessageEntry &&
		currentChannelChatLog.length > 0 &&
		currentChannelChatLog[currentChannelChatLog.length - 1]?.extension?.platform_message_ids?.some(id => repliedToMessageEntry.extension?.platform_message_ids?.includes(id)) &&
		(channelMessageQueues[channelId] || []).length === 0
	)
		repliedToMessageEntry = undefined // 避免对同一条消息重复回复或错误回复


	const textContent = replyToSend.content || ''
	const files = replyToSend.files || []
	let firstSentMessageEntry = null

	if (!textContent && (!files || files.length === 0)) {
		console.warn('[BotLogic] sendAndLogReply: Attempted to send empty message, skipped.', replyToSend)
		return null // 如果没有内容也没有文件，则不发送
	}

	const splitTexts = platformAPI.splitReplyText(textContent)
	const payloadForPlatform = { ...replyToSend } // 复制一份，避免修改原始 replyToSend

	if (splitTexts.length === 0 && files.length > 0) { // 只有文件，没有文本
		payloadForPlatform.content = undefined // 确保平台API不会发送空字符串
		payloadForPlatform.files = files
		const sentEntry = await platformAPI.sendMessage(channelId, payloadForPlatform, repliedToMessageEntry)
		if (sentEntry) {
			firstSentMessageEntry = sentEntry
			// 机器人发出的消息也需要加入到聊天记录中
			channelChatLogs[channelId] = [...channelChatLogs[channelId] || [], sentEntry]
			while (channelChatLogs[channelId].length > currentConfig.DefaultMaxMessageDepth)
				channelChatLogs[channelId].shift()
		}
	} else  // 有文本，可能有文件
		for (let i = 0; i < splitTexts.length; i++) {
			const currentTextPart = splitTexts[i]
			const isLastTextPart = i === splitTexts.length - 1

			payloadForPlatform.content = currentTextPart
			payloadForPlatform.files = isLastTextPart ? files : [] // 文件只在最后一条消息中发送

			const sentEntry = await platformAPI.sendMessage(channelId, payloadForPlatform, repliedToMessageEntry)
			if (sentEntry) {
				if (i === 0)  // 只记录第一条分片消息作为代表
					firstSentMessageEntry = sentEntry

				// 机器人发出的消息也需要加入到聊天记录中
				channelChatLogs[channelId] = [...channelChatLogs[channelId] || [], sentEntry]
				while (channelChatLogs[channelId].length > currentConfig.DefaultMaxMessageDepth)
					channelChatLogs[channelId].shift()
			}
			// 如果是分多条发送，后续消息不应再引用 repliedToMessageEntry，以避免平台行为异常
			if (repliedToMessageEntry) repliedToMessageEntry = undefined
		}


	if (firstSentMessageEntry)
		channelLastSendMessageTime[channelId] = Date.now() // 更新最后发言时间

	return firstSentMessageEntry
}


/**
 * 处理单个频道的消息队列。
 * @async
 * @param {string | number} channelId - 当前正在处理的频道 ID。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 */
async function handleMessageQueue(channelId, platformAPI) {
	if (!channelMessageQueues[channelId]?.length)
		return delete channelHandlers[channelId] // 如果队列为空，删除处理句柄

	// 初始化或获取历史聊天记录
	if (!channelChatLogs[channelId] || channelChatLogs[channelId].length === 0) {
		const historicalMessages = await platformAPI.fetchChannelHistory(channelId, currentConfig.DefaultMaxFetchCount)
		const mergedHistoricalLog = mergeChatLogEntries(historicalMessages.sort((a, b) => a.timeStamp - b.timeStamp))
		channelChatLogs[channelId] = mergedHistoricalLog
		// 确保历史记录不超过最大深度
		while (channelChatLogs[channelId].length > currentConfig.DefaultMaxMessageDepth)
			channelChatLogs[channelId].shift()

		channelChatLogs[channelId].pop()
		channelMessageQueues[channelId] = channelMessageQueues[channelId].slice(-1)
	}
	const myQueue = channelMessageQueues[channelId]
	const currentChannelLog = channelChatLogs[channelId]

	while (myQueue.length) try {
		let currentMessageToProcess = myQueue[0] // 从队列头取出一个消息
		if (!currentMessageToProcess) { myQueue.shift(); continue }

		// 尝试合并连续消息 (行内合并逻辑，补充 mergeChatLogEntries 的不足)
		const lastLogEntry = currentChannelLog.length > 0 ? currentChannelLog[currentChannelLog.length - 1] : null
		function is_can_marge() {
			return lastLogEntry && currentMessageToProcess &&
				lastLogEntry.name === currentMessageToProcess.name &&
				currentMessageToProcess.timeStamp - lastLogEntry.timeStamp < currentConfig.MergeMessagePeriodMs &&
				(lastLogEntry.files || []).length === 0 &&
				lastLogEntry.extension?.platform_message_ids && // 确保有平台ID可以合并
				currentMessageToProcess.extension?.platform_message_ids
		}
		async function checkTrigger() {
			// 如果消息是机器人自己发的，则跳过后续处理
			if (currentMessageToProcess.extension?.platform_user_id === platformAPI.getBotUserId())
				return

			// 处理主人专属命令
			if (currentMessageToProcess.extension?.is_from_owner) {
				const { content } = currentMessageToProcess
				// 催眠模式下的命令限制：只有在当前频道是催眠频道，或者没有催眠频道时，才处理这些命令
				if (!inHypnosisChannelId || channelId === inHypnosisChannelId) {
					if (base_match_keys(content, [/^龙胆.{0,2}敷衍点.{0,2}$/])) fuyanMode = true
					if (base_match_keys(content, [/^龙胆.{0,2}不敷衍点.{0,2}$/])) fuyanMode = false
					if (base_match_keys(content, [/^龙胆.{0,2}自裁.{0,2}$/])) {
						const selfDestructReply = inHypnosisChannelId === channelId ? { content: '好的。' } : { content: '啊，咱死了～' }
						await sendAndLogReply(selfDestructReply, platformAPI, channelId, currentMessageToProcess)
						newUserMessage(content, platformAPI.name)
						newCharReplay(selfDestructReply.content, platformAPI.name)
						await platformAPI.destroySelf()
						return 'exit'// 自裁后直接返回，停止后续处理
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
					// 旧版龙胆龙胆逻辑，新版简化了正则
					if (base_match_keys(content, [/^(龙胆|[\n,.~、。呵哦啊嗯噫欸，～])+$/, /^龙胆龙胆(龙胆|[\n!,.?~、。呵哦啊嗯噫欸！，？～])+$/])) {
						const ownerCallReply = SimplifiyChinese(content).replaceAll('龙胆', '主人')
						await sendAndLogReply({ content: ownerCallReply }, platformAPI, channelId, currentMessageToProcess)
						newUserMessage(content, platformAPI.name)
						newCharReplay(ownerCallReply, platformAPI.name)
						return
					}
				}
			}

			// 检查是否存在其他同名机器人 (基于近期日志)
			const recentChatLogForOtherBotCheck = currentChannelLog.filter(msg => (Date.now() - msg.timeStamp) < 5 * 60 * 1000) // 近5分钟日志
			const hasOtherGentianBot = (() => {
				if (recentChatLogForOtherBotCheck.length < (currentConfig.MinLogForOtherBotCheck || 5)) return false
				const text = recentChatLogForOtherBotCheck
					.filter(msg => msg.extension?.platform_user_id !== platformAPI.getBotUserId()) // 排除机器人自己的消息
					.map(msg => msg.content).join('\n')
				// 旧版逻辑: text.includes('龙胆') && text.match(/主人/g)?.length > 1
				return base_match_keys(text, GentianWords) && (text.match(/主人/g)?.length || 0) > 1
			})()

			const isMutedChannel = (Date.now() - (channelMuteStartTimes[channelId] || 0)) < currentConfig.MuteDurationMs

			// --- 核心触发逻辑 ---
			// 旧版逻辑: 若最近7条消息都是bot和owner的消息，且当前消息是owner发的，则直接回复
			const lastFewMessages = currentChannelLog.slice(-7) // 获取最近最多7条消息
			// --- 修复开始: 修正 ownerBotOnlyInteraction 的判断条件，不要求固定长度为7，以匹配旧版逻辑 ---
			// 旧版: chatlog.slice(-7).every(message => message.role == 'user' || message.name == client.user.username)
			// message.role == 'user' 对应 is_from_owner
			// message.name == client.user.username 对应 platform_user_id === platformAPI.getBotUserId()
			const ownerBotOnlyInteraction = lastFewMessages.every(
				msg => msg.extension?.is_from_owner || msg.extension?.platform_user_id === platformAPI.getBotUserId()
			)
			// --- 修复结束 ---

			if (ownerBotOnlyInteraction && currentMessageToProcess.extension?.is_from_owner && !isMutedChannel)
				// 如果是纯粹的主人-机器人对话，并且当前是主人发言，且频道未静默，则直接回复
				return 1

			else if (await checkMessageTrigger(currentMessageToProcess, platformAPI, channelId, { has_other_gentian_bot: hasOtherGentianBot }))
				// 否则，通过 checkMessageTrigger 判断是否回复
				return 1

			else if ( // 如果不触发回复，且满足复读条件
				(!inHypnosisChannelId || channelId !== inHypnosisChannelId) && // 非催眠状态或非催眠频道
				!isMutedChannel && // 频道未静默
				currentMessageToProcess.extension?.platform_user_id !== platformAPI.getBotUserId() // 不是机器人自己发的消息
			) {
				// 复读逻辑
				const repet = findMostFrequentElement(
					currentChannelLog.slice(-10), // 取最近10条进行复读判断
					// 旧版复读元素是 content + files_hex_string
					message => (message.content || '') + '\n\n' + (message.files || []).map(file => file.buffer instanceof Buffer ? file.buffer.toString('hex') : String(file.buffer)).join('\n')
				)
				if (
					repet.element?.content && // 确保复读内容存在 (旧版直接用 repet.element.content)
					repet.count >= currentConfig.RepetitionTriggerCount && // 达到复读次数
					// 旧逻辑 spec_words = [...config.OwnerNameKeywords, ...rude_words, ...Gentian_words]
					!base_match_keys(repet.element.content, [...currentMessageToProcess.extension.OwnerNameKeywords, ...rude_words, ...GentianWords]) && // 非特殊词汇
					!repet.element.content.match(/^[!$%&/\\！]/) && // 非机器人指令
					// 确保机器人自己没有复读过这条消息
					!currentChannelLog.some(msg => msg.extension?.platform_user_id === platformAPI.getBotUserId() && msg.content === repet.element.content)
				)
					await sendAndLogReply(
						{ content: repet.element.content, files: repet.element.files },
						platformAPI, channelId, currentMessageToProcess
					)

			}
		}
		let triggered = false
		if (!is_can_marge()) {
			currentChannelLog.push(currentMessageToProcess) // 不合并，直接加入日志
			myQueue.shift() // 移除已合并的消息
			switch (await checkTrigger()) {
				case 'exit': return
				case 1: triggered = true
			}
		}
		else do {
			lastLogEntry.content += '\n' + currentMessageToProcess.content
			lastLogEntry.files = currentMessageToProcess.files // 合并文件 (通常后一条消息的文件会覆盖)
			lastLogEntry.timeStamp = currentMessageToProcess.timeStamp // 更新时间戳
			lastLogEntry.extension = { // 合并扩展信息
				...lastLogEntry.extension,
				...currentMessageToProcess.extension,
				platform_message_ids: Array.from(new Set([ // 合并平台消息ID
					...lastLogEntry.extension.platform_message_ids,
					...currentMessageToProcess.extension.platform_message_ids
				]))
			}
			myQueue.shift() // 移除已合并的消息
			switch (await checkTrigger()) {
				case 'exit': return
				case 1: triggered = true
			}
			currentMessageToProcess = myQueue[0]
		} while (is_can_marge())

		// 维护聊天记录深度
		while (currentChannelLog.length > currentConfig.DefaultMaxMessageDepth)
			currentChannelLog.shift()

		currentMessageToProcess = currentChannelLog[currentChannelLog.length - 1]
		if (triggered)
			await doMessageReplyInternal(currentMessageToProcess, platformAPI, channelId)
	} catch (error) {
		// 发生错误时，尝试使用队列中最后一条消息或日志中最后一条消息作为上下文
		const lastMessageInQueueOrLog = myQueue.length > 0 ? myQueue[myQueue.length - 1] : channelChatLogs[channelId]?.slice(-1)[0]
		await handleError(error, platformAPI, lastMessageInQueueOrLog)
	} finally {
		// 如果处理完后队列仍为空，则清理句柄 (以防万一在循环中发生错误导致句柄未被清理)
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
	const errorMessageForRecord = `\`\`\`\n${errorStack}\n\`\`\`` // 用于去重和AI分析的错误信息

	// 简易错误去重，防止短时间内大量相同错误刷屏
	if (errorRecord[errorMessageForRecord]) return
	errorRecord[errorMessageForRecord] = true
	setTimeout(() => delete errorRecord[errorMessageForRecord], 60000) // 60秒后允许再次报告相同错误

	let aiSuggestionReply
	try {
		// 准备AI自我修复请求的参数
		const botPlatformId = platformAPI.getBotUserId()
		const fountBotDisplayName = (await charAPI.getPartInfo?.(localhostLocales[0]))?.name || BotCharname
		const botNameForAI = userIdToNameMap[botPlatformId] || `${platformAPI.getBotUsername()} (咱自己)` || `${fountBotDisplayName} (咱自己)`

		const ownerPlatformUsername = platformAPI.getOwnerUserName()
		const ownerPlatformId = platformAPI.getOwnerUserId()
		const ownerNameForAI = userIdToNameMap[ownerPlatformId] || ownerPlatformUsername || FountUsername

		const currentChannelId = contextMessage?.extension?.platform_channel_id
		const isInHypnosisForError = !!(currentChannelId && currentChannelId === inHypnosisChannelId) // 判断错误上下文是否在催眠频道

		// 构建用于AI自我修复的聊天记录
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
			currentChannelId || 'self-repair-context', // 如果没有上下文频道，使用通用名称
			contextMessage
		)

		/** @type {FountChatReplyRequest_t} */
		const selfRepairRequest = {
			supported_functions: { markdown: true, mathjax: true, html: false, unsafe_html: false, files: true, add_message: false }, // 自我修复不应再发送消息
			username: FountUsername,
			chat_name: chatNameForSelfRepair,
			char_id: BotCharname,
			Charname: botNameForAI,
			UserCharname: ownerNameForAI,
			locales: localhostLocales,
			time: new Date(),
			world: platformAPI.getPlatformWorld(), // 使用当前平台的世界观
			user: null,
			char: charAPI,
			other_chars: [],
			plugins: {}, // 自我修复时不加载常规插件
			chat_summary: '',
			chat_scoped_char_memory: {}, // 使用空的短期记忆，避免干扰
			chat_log: selfRepairChatLog,
			extension: { platform: contextMessage?.extension?.platform || 'unknown' }
		}

		aiSuggestionReply = await charAPI.interfaces.chat.GetReply(selfRepairRequest)

	} catch (anotherError) { // 如果AI自我修复也出错了
		const anotherErrorStack = anotherError.stack || anotherError.message
		const currentChannelId = contextMessage?.extension?.platform_channel_id
		const isHypnosisContextForError = !!(inHypnosisChannelId && currentChannelId && currentChannelId === inHypnosisChannelId)

		if (`${error.name}: ${error.message}` === `${anotherError.name}: ${anotherError.message}`)  // 如果是同样的错误循环
			aiSuggestionReply = { content: isHypnosisContextForError ? '抱歉，洗脑母畜龙胆没有解决思路。' : '没什么解决思路呢？' }
		else
			aiSuggestionReply = { content: '```\n' + anotherErrorStack + '\n```\n' + (isHypnosisContextForError ? '抱歉，洗脑母畜龙胆没有解决思路。' : '没什么解决思路呢？') }

	}

	// 组合最终的错误回复内容
	let fullReplyContent = errorMessageForRecord + '\n' + (aiSuggestionReply?.content || '')
	// 替换IP地址，保护隐私 (旧版逻辑)
	const randomIPDict = {}
	fullReplyContent = fullReplyContent.replace(/(?:\d{1,3}\.){3}\d{1,3}/g, ip => randomIPDict[ip] ??= Array(4).fill(0).map(() => Math.floor(Math.random() * 255)).join('.'))

	try {
		// 尝试在发生错误的频道回复错误信息
		if (contextMessage?.extension?.platform_channel_id)
			await sendAndLogReply({ content: fullReplyContent }, platformAPI, contextMessage.extension.platform_channel_id, undefined)
		else
			// 如果没有上下文频道，则记录到平台日志
			platformAPI.logError(new Error('[BotLogic] Error occurred (no context channel to reply): ' + fullReplyContent.substring(0, 1000) + '...'), undefined)
	} catch (sendError) { // 如果发送错误通知也失败了
		platformAPI.logError(sendError, contextMessage) // 记录发送失败的错误
		console.error('[BotLogic] Failed to send error notification. Original error:', error, 'Send error:', sendError)
	}
	// 无论如何，都将原始错误记录到平台日志和控制台
	platformAPI.logError(error, contextMessage)
	console.error('[BotLogic] Original error handled:', error, 'Context:', contextMessage)
	await reloadPart(FountUsername, 'chars', BotCharname)
}


// --- 暴露给接入层的接口 ---

/**
 * 处理从接入层传入的新消息。
 * @async
 * @param {chatLogEntry_t_ext} fountEntry - 已经由接入层转换为 Fount 格式的平台消息条目。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {string | number} channelId - 消息所在的频道 ID。
 */
export async function processIncomingMessage(fountEntry, platformAPI, channelId) {
	try {
		updateBotNameMapping(platformAPI) // 更新机器人名称映射

		// 更新用户ID和名称的映射
		const senderId = fountEntry.extension?.platform_user_id
		const senderName = fountEntry.name
		if (senderId && senderName) {
			if (!userIdToNameMap[senderId] || userIdToNameMap[senderId] !== senderName)
				userIdToNameMap[senderId] = senderName

			if (!nameToUserIdMap[senderName] || nameToUserIdMap[senderName] !== senderId)
				// 注意：nameToUserIdMap 可能因昵称冲突而不准确，主要用于机器人自身名称的规范化
				nameToUserIdMap[senderName] = senderId

		}

		channelMessageQueues[channelId] ??= [] // 初始化频道消息队列
		channelMessageQueues[channelId].push(fountEntry) // 将消息加入队列

		// 如果当前频道没有正在运行的消息处理句柄，则启动一个新的
		if (!channelHandlers[channelId])
			channelHandlers[channelId] = handleMessageQueue(channelId, platformAPI)
				.catch(err => { // 捕获 handleMessageQueue 中的未处理错误
					handleError(err, platformAPI, fountEntry) // 使用当前消息作为上下文
				})
				.finally(() => {
					// 无论成功或失败，如果队列为空，则清理句柄
					// (handleMessageQueue 内部也会清理，这里是双重保险)
					if (channelMessageQueues[channelId]?.length === 0)
						delete channelHandlers[channelId]

				})

	} catch (error) { // 捕获 processIncomingMessage 本身的同步错误
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
	if (!log || !updatedFountEntry.extension?.platform_message_ids || updatedFountEntry.extension.platform_message_ids.length === 0) return

	// 通常编辑事件只涉及一个原始消息ID
	const originalMsgIdToFind = updatedFountEntry.extension.platform_message_ids[0]

	const entryIndex = log.findIndex(entry =>
		entry.extension?.platform_message_ids?.includes(originalMsgIdToFind)
	)

	if (entryIndex > -1) {
		const oldEntry = log[entryIndex]
		// 合并扩展信息，确保 platform_message_ids 包含所有相关ID
		const newExtension = {
			...oldEntry.extension,
			...updatedFountEntry.extension,
			platform_message_ids: Array.from(new Set([
				...oldEntry.extension?.platform_message_ids || [],
				...updatedFountEntry.extension?.platform_message_ids || []
			]))
		}

		// 更新日志条目
		log[entryIndex] = {
			...updatedFountEntry, // 使用更新后的条目作为基础
			content: `${updatedFountEntry.content}\n（已编辑）`, // 标记为已编辑
			extension: newExtension,
			// 保留旧条目的 role 和 name，除非更新条目明确提供了新的
			role: updatedFountEntry.role || oldEntry.role,
			name: updatedFountEntry.name || oldEntry.name,
		}
	}
}

/**
 * Bot 清理函数。
 * 在应用关闭前调用，以确保所有正在处理的任务完成。
 * @async
 */
export async function cleanup() {
	console.log('[BotLogic] Starting cleanup...')
	// 等待所有频道的当前消息处理句柄完成
	// Object.values(channelHandlers) 可能包含 undefined 或 null (如果句柄已删除)
	// filter(Boolean) 确保只等待有效的 Promise
	await Promise.allSettled(Object.values(channelHandlers).filter(Boolean))
	console.log('[BotLogic] All channel handlers completed. Cleanup finished.')
}

/**
 * Checks a group for the presence of the owner and takes action if the owner is not found.
 * @param {import('./index.mjs').GroupObject} group - The group to check.
 * @param {import('./index.mjs').PlatformAPI_t} platformAPI - The platform API instance.
 * @param {string | number | null} ownerOverride - (Optional) Override for owner user ID for testing.
 */
async function handleGroupCheck(group, platformAPI, ownerOverride = null) {
    if (!group || !platformAPI) {
        console.error('[BotLogic] handleGroupCheck: Invalid group or platformAPI provided.');
        return;
    }
    console.log(`[BotLogic] Checking group: ${group.name} (ID: ${group.id}) on platform: ${platformAPI.name}`);

    try {
        const ownerIdToCompare = ownerOverride || platformAPI.getOwnerUserId?.();
        const ownerUsernameToCompare = platformAPI.getOwnerUserName?.(); // For Discord

        if (!ownerIdToCompare && platformAPI.name === 'telegram') {
            console.error(`[BotLogic] No OwnerUserID configured for Telegram. Cannot perform owner check for group ${group.id}.`);
            return;
        }
         if (!ownerUsernameToCompare && platformAPI.name === 'discord') {
            console.error(`[BotLogic] No OwnerUserName configured for Discord. Cannot perform owner check for group ${group.id}.`);
            return;
        }

        const members = await platformAPI.getGroupMembers?.(group.id);
        if (!members) {
            console.warn(`[BotLogic] Could not retrieve members for group ${group.id} on ${platformAPI.name}. Skipping owner check.`);
            return;
        }

        const ownerIsPresent = members.some(member =>
            (platformAPI.name === 'telegram' && String(member.id) === String(ownerIdToCompare)) ||
            (platformAPI.name === 'discord' && member.username && ownerUsernameToCompare && member.username.toLowerCase() === ownerUsernameToCompare.toLowerCase())
        );

        if (ownerIsPresent) {
            console.log(`[BotLogic] Owner found in group ${group.name} (ID: ${group.id}). No action needed.`);
            return;
        }

        // Owner is NOT present
        console.log(`[BotLogic] Owner NOT found in group ${group.name} (ID: ${group.id}). Taking action...`);

        const defaultChannel = await platformAPI.getGroupDefaultChannel?.(group.id);
        if (!defaultChannel) {
            console.warn(`[BotLogic] Could not find a default channel for group ${group.id}. Cannot send invite or message.`);
            await platformAPI.leaveGroup?.(group.id); // Leave group if no channel to message
            console.log(`[BotLogic] Left group ${group.id} due to no default channel.`);
            return;
        }

        let inviteLink = null;
        if (platformAPI.generateInviteLink) {
            inviteLink = await platformAPI.generateInviteLink(group.id, defaultChannel.id);
        }

        if (inviteLink) {
            const inviteMessage = `咱加入了一个您不在的群组: "${group.name}" (ID: ${group.id}) on ${platformAPI.name}. 邀请链接: ${inviteLink}`;
            if (platformAPI.sendDirectMessageToOwner) {
                await platformAPI.sendDirectMessageToOwner(inviteMessage);
                console.log(`[BotLogic] Sent DM to owner about group ${group.id}.`);
            } else {
                 console.warn(`[BotLogic] sendDirectMessageToOwner not implemented for ${platformAPI.name}.`);
            }

            // Notify other groups where owner is present
            const allJoinedGroups = await platformAPI.getJoinedGroups?.();
            if (allJoinedGroups) {
                for (const otherGroup of allJoinedGroups) {
                    if (otherGroup.id === group.id) continue; // Skip the current group

                    const otherGroupMembers = await platformAPI.getGroupMembers?.(otherGroup.id);
                    if (otherGroupMembers) {
                        const ownerInOtherGroup = otherGroupMembers.some(member =>
                            (platformAPI.name === 'telegram' && String(member.id) === String(ownerIdToCompare)) ||
                            (platformAPI.name === 'discord' && member.username && ownerUsernameToCompare && member.username.toLowerCase() === ownerUsernameToCompare.toLowerCase())
                        );
                        if (ownerInOtherGroup) {
                            const otherGroupDefaultChannel = await platformAPI.getGroupDefaultChannel?.(otherGroup.id);
                            if (otherGroupDefaultChannel && platformAPI.sendMessage) {
                                try {
                                    await platformAPI.sendMessage(otherGroupDefaultChannel.id, { content: inviteMessage });
                                    console.log(`[BotLogic] Sent invite to owner in group ${otherGroup.name} (Channel: ${otherGroupDefaultChannel.id}).`);
                                } catch (e) {
                                    console.error(`[BotLogic] Failed to send invite to owner in group ${otherGroup.name}:`, e);
                                }
                            }
                        }
                    }
                }
            }
        } else {
            console.warn(`[BotLogic] Could not generate invite link for group ${group.id}.`);
        }

        // Generate and send insult
        const groupNameForAI = group.name || `Group ${group.id}`;
        let channelHistoryForAI = [];
        if (platformAPI.fetchChannelHistory) {
             // Fetch a small number of messages for context, e.g., 5-10
             channelHistoryForAI = await platformAPI.fetchChannelHistory(defaultChannel.id, 10);
        }

        // Construct a basic chat log for the insult generation
        const insultRequestContext = [
            ...channelHistoryForAI, // Add some recent messages from the channel
            { name: 'system', role: 'system', timeStamp: Date.now(), content: `Current group name: "${groupNameForAI}". Generate an insulting message directed at this group.` },
            { name: 'system', role: 'system', timeStamp: Date.now(), content: 'You are now in rude mode. Be very insulting as per RudePrompt.'} // Try to trigger RudePrompt
        ];
        
         const fountBotDisplayName = (await charAPI.getPartInfo?.(localhostLocales[0]))?.name || BotCharname;
         const botUserId = platformAPI.getBotUserId?.();
         const botUsername = platformAPI.getBotUsername?.();
         const botDisplayName = platformAPI.getBotDisplayName?.();
         const botNameForAIChat = userIdToNameMap[botUserId] || `${botUsername} (咱自己)` || `${botDisplayName} (咱自己)` || `${fountBotDisplayName} (咱自己)`;
         
         const ownerPlatformUsername = platformAPI.getOwnerUserName?.() || 'Owner';
         const ownerPlatformId = platformAPI.getOwnerUserId?.();
         const userCharNameForAI = userIdToNameMap[ownerPlatformId] || ownerPlatformUsername;

        const insultRequest = {
            supported_functions: { markdown: true, files: false, add_message: false, mathjax: false, html: false, unsafe_html: false },
            username: FountUsername,
            chat_name: `InsultContext:${platformAPI.name}:${group.id}`,
            char_id: BotCharname, 
            Charname: botNameForAIChat,
            UserCharname: userCharNameForAI, 
            ReplyToCharname: groupNameForAI, 
            locales: localhostLocales, 
            time: new Date(),
            world: platformAPI.getPlatformWorld?.() || null,
            user: null,
            char: charAPI,
            other_chars: [],
            plugins: { ...platformAPI.getPlatformSpecificPlugins?.({ extension: { platform_guild_id: group.id, platform_channel_id: defaultChannel.id, platform: platformAPI.name } } || {}), rude: {} },
            chat_summary: `Context for generating an insult for group "${groupNameForAI}".`,
            chat_scoped_char_memory: {}, 
            chat_log: insultRequestContext,
            extension: { platform: platformAPI.name, chat_id: defaultChannel.id, is_direct_message: false }
        };
        
        let insultMessageContent = "你群没主人，爷走了。"; // Default insult
        try {
            const aiInsultReply = await charAPI.interfaces.chat.GetReply(insultRequest);
            if (aiInsultReply && aiInsultReply.content) {
                insultMessageContent = aiInsultReply.content;
            }
        } catch (e) {
            console.error(`[BotLogic] AI insult generation failed for group ${group.id}:`, e);
        }

        if (platformAPI.sendMessage) {
            try {
                await platformAPI.sendMessage(defaultChannel.id, { content: insultMessageContent });
                console.log(`[BotLogic] Sent insult to group ${group.id}.`);
            } catch (e) {
                console.error(`[BotLogic] Failed to send insult to group ${group.id}:`, e);
            }
        }

        // Leave group
        if (platformAPI.leaveGroup) {
            await platformAPI.leaveGroup(group.id);
            console.log(`[BotLogic] Left group ${group.id} after actions.`);
        }

    } catch (error) {
        console.error(`[BotLogic] Error in handleGroupCheck for group ${group.id} on ${platformAPI.name}:`, error);
    }
}

/**
 * Registers a platform API instance.
 * Should be called by each platform interface upon its initialization.
 * @param {PlatformAPI_t} platformAPI - The platform API instance to register.
 */
export function registerPlatformAPI(platformAPI) {
    if (platformAPI && typeof platformAPI.name === 'string') {
        if (!registeredPlatformAPIs.find(p => p.name === platformAPI.name)) {
            registeredPlatformAPIs.push(platformAPI);
            console.log(`[BotLogic] Platform API registered: ${platformAPI.name}`);
        } else {
            console.warn(`[BotLogic] Platform API ${platformAPI.name} already registered.`);
        }
    } else {
        console.error('[BotLogic] Attempted to register an invalid platform API.');
    }
}

/**
 * Finalizes the initialization of core features after all platform APIs are expected to be registered.
 * This will set up group join handlers and perform startup checks for existing groups.
 * Should be called by the main application logic after initializing all platform interfaces.
 */
let coreFeaturesInitialized = false;
export async function finalizeCoreInitialization() {
    if (coreFeaturesInitialized) {
        console.warn('[BotLogic] Core features already finalized. Skipping.');
        return;
    }
    if (registeredPlatformAPIs.length === 0) {
        console.warn('[BotLogic] No platform APIs registered. Skipping core feature finalization.');
        return;
    }

    console.log('[BotLogic] Finalizing core features for all registered platforms...');
    for (const platformAPI of registeredPlatformAPIs) {
        if (platformAPI.onGroupJoin) {
            platformAPI.onGroupJoin(async (group) => {
                await new Promise(resolve => setTimeout(resolve, platformAPI.name === 'discord' ? 5000 : 1000));
                await handleGroupCheck(group, platformAPI);
            });
            console.log(`[BotLogic] Registered onGroupJoin handler for platform: ${platformAPI.name}`);
        } else {
            console.warn(`[BotLogic] onGroupJoin not implemented for platform: ${platformAPI.name}`);
        }

        if (platformAPI.getJoinedGroups) {
            try {
                console.log(`[BotLogic] Performing startup check for existing groups on platform: ${platformAPI.name}`);
                const joinedGroups = await platformAPI.getJoinedGroups();
                if (joinedGroups && joinedGroups.length > 0) {
                    console.log(`[BotLogic] Found ${joinedGroups.length} groups on ${platformAPI.name}. Checking each...`);
                    for (const group of joinedGroups) {
                        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
                        await handleGroupCheck(group, platformAPI);
                    }
                } else {
                    console.log(`[BotLogic] No existing groups found to check on ${platformAPI.name}.`);
                }
            } catch (e) {
                console.error(`[BotLogic] Error during startup group check for ${platformAPI.name}:`, e);
            }
        } else {
            console.warn(`[BotLogic] getJoinedGroups not implemented for platform: ${platformAPI.name}. Skipping startup check.`);
        }
    }
    coreFeaturesInitialized = true;
    console.log('[BotLogic] Core features finalization complete.');
}
