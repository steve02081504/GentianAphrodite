/**
 * fount 基础聊天日志条目类型。
 * @typedef {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatLogEntry_t} FountChatLogEntryBase
 */

/**
 * 扩展的 fount 聊天日志条目类型，包含平台特定信息。
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
export const channelLastSendMessageTime = {}

/**
 * 存储各个频道的聊天记录。
 * 键为频道 ID，值为 {@link chatLogEntry_t_ext} 数组。
 * @type {Record<string | number, chatLogEntry_t_ext[]>}
 */
export const channelChatLogs = {}

/**
 * 存储 AI 角色在各个频道的短期记忆 (由 AI 自身管理)。
 * 键为频道 ID，值为任意类型的记忆数据。
 * @type {Record<string | number, any>}
 */
export const channelCharScopedMemory = {}

/**
 * 记录各个频道进入静默状态的开始时间戳。
 * 键为频道 ID，值为毫秒级时间戳。
 * @type {Record<string | number, number>}
 */
export const channelMuteStartTimes = {}

/**
 * 简易错误去重记录，防止短时间内重复报告相同错误。
 * 键为错误消息的字符串表示，值为布尔值 true。
 * @type {Record<string, boolean>}
 */
export const errorRecord = {}

/**
 * Bot 是否处于敷衍模式。
 * @type {boolean}
 */
export let fuyanMode = false

/**
 * 当前 Bot 是否处于特定催眠模式的频道 ID。
 * 如果为 null，则 Bot 不处于任何催眠模式。
 * @type {string | number | null}
 */
export let inHypnosisChannelId = null

/**
 * 禁止 Bot 输出的字符串列表。
 * @type {string[]}
 */
export const bannedStrings = []

/**
 * 用户平台 ID 到显示名称的映射。
 * 用于在日志和 AI 请求中显示更友好的用户名称。
 * @type {Record<string | number, string>}
 */
export const userIdToNameMap = {}

/**
 * 显示名称到用户平台 ID 的映射 (辅助功能，可能有冲突)。
 * 键为显示名称 (string)，值为用户 ID (string | number)。
 * @type {Record<string, string | number>}
 */
export const nameToUserIdMap = {}

/**
 * 各个频道的消息处理队列。
 * 键为频道 ID，值为待处理的 {@link chatLogEntry_t_ext} 数组。
 * @type {Record<string | number, chatLogEntry_t_ext[]>}
 */
export const channelMessageQueues = {}

/**
 * 记录各个频道当前是否有消息处理句柄 (Promise) 在运行。
 * 键为频道 ID，值为 Promise 对象。用于防止同一频道并发处理。
 * @type {Record<string | number, Promise<void>>}
 */
export const channelHandlers = {}

/**
 * 当前 Bot 逻辑层的配置。
 * @type {BotLogicConfig_t}
 */
export let currentConfig = {
	DefaultMaxMessageDepth: 20,
	DefaultMaxFetchCount: 30,
	BaseTriggerChanceToOwner: 7,
	RepetitionTriggerCount: 4,
	MuteDurationMs: 3 * 60 * 1000,
	InteractionFavorPeriodMs: 3 * 60 * 1000,
	MergeMessagePeriodMs: 3 * 60 * 1000,
}

/**
 * 龙胆的关键词列表。
 * @type {string[]}
 */
export const GentianWords = ['龙胆', 'gentian']

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
 * 设置敷衍模式。
 * @param {boolean} value - 是否开启敷衍模式。
 */
export function setFuyanMode(value) {
	fuyanMode = value
}

/**
 * 设置当前 Bot 是否处于特定催眠模式的频道 ID。
 * @param {string | number | null} value - 频道 ID，如果为 null，则 Bot 不处于任何催眠模式。
 */
export function setInHypnosisChannelId(value) {
	inHypnosisChannelId = value
}

/**
 * 缓存的频道 ID 列表 (LRU，索引 0 为最近使用)。
 * @type {(string|number)[]}
 */
export const cachedChannelIds = []

/**
 * 最大缓存频道数量。
 * @type {number}
 */
export const MAX_CHANNEL_CACHE_SIZE = 1024

/**
 * 更新频道缓存顺序 (LRU)。
 * 将指定频道移动到缓存列表头部。如果缓存已满，则移除最旧的频道并清理其日志。
 * @param {string | number} channelId - 频道 ID。
 */
export function touchChannelCache(channelId) {
	const idx = cachedChannelIds.indexOf(channelId)
	if (idx !== -1) cachedChannelIds.splice(idx, 1)
	cachedChannelIds.unshift(channelId)

	while (cachedChannelIds.length > MAX_CHANNEL_CACHE_SIZE) {
		const toRemove = cachedChannelIds.pop()
		if (toRemove && channelChatLogs[toRemove])
			delete channelChatLogs[toRemove]
	}
}
