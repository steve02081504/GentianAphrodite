import { handleError } from './error.mjs'
import { registerPlatformAPI as registerGroupHandlers } from './group_handler.mjs'
import { configure, channelMessageQueues, channelHandlers, channelChatLogs, currentConfig } from './state.mjs'
import { processNextMessageInQueue } from './trigger.mjs'
import { mergeChatLogEntries, updateBotNameMapping, updateUserCache } from './utils.mjs'

/**
 * 导出核心机器人逻辑的主要入口点和配置功能。
 */
export { configure, registerGroupHandlers as registerPlatformAPI }

/**
 * fount 基础聊天日志条目类型。
 * @typedef {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatLogEntry_t} FountChatLogEntryBase
 */

/**
 * fount 聊天回复对象类型。
 * @typedef {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatReply_t} FountChatReply_t
 */

/**
 * fount 聊天回复请求对象类型。
 * @typedef {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatReplyRequest_t} FountChatReplyRequest_t
 */

/**
 * fount 插件 API 对象类型。
 * @typedef {import('../../../../../../src/decl/pluginAPI.ts').pluginAPI_t} pluginAPI_t
 */

/**
 * fount 世界观 API 对象类型。
 * @typedef {import('../../../../../../src/decl/WorldAPI.ts').WorldAPI_t} WorldAPI_t
 */

/**
 * 扩展的 fount 聊天日志条目类型，包含平台特定信息。
 * @typedef {import('./state.mjs').chatLogEntry_t_ext} chatLogEntry_t_ext
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
 * 循环处理单个频道消息队列中的所有消息。
 * @async
 * @param {chatLogEntry_t_ext[]} myQueue - 当前频道的消息队列。
 * @param {chatLogEntry_t_ext[]} currentChannelLog - 当前频道的聊天记录。
 * @param {PlatformAPI_t} platformAPI - 平台 API。
 * @param {string | number} channelId - 频道 ID。
 * @returns {Promise<void>}
 */
async function processQueue(myQueue, currentChannelLog, platformAPI, channelId) {
	while (myQueue.length)
		if (await processNextMessageInQueue(myQueue, currentChannelLog, platformAPI, channelId)) return
}

/**
 * 处理单个频道的消息队列。
 * @async
 * @param {string | number} channelId - 当前正在处理的频道 ID。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @returns {Promise<void>}
 */
async function handleMessageQueue(channelId, platformAPI) {
	if (!channelMessageQueues[channelId]?.length)
		return delete channelHandlers[channelId]

	await initializeChannelLogIfEmpty(channelId, platformAPI)

	const myQueue = channelMessageQueues[channelId]
	const currentChannelLog = channelChatLogs[channelId]

	try {
		await processQueue(myQueue, currentChannelLog, platformAPI, channelId)
	}
	catch (error) {
		if (error.skip_auto_fix) throw error
		const contextMessage = myQueue.length ? myQueue[myQueue.length - 1] : currentChannelLog?.slice(-1)[0]
		await handleError(error, platformAPI, contextMessage)
	}
	finally {
		if (!channelMessageQueues[channelId]?.length)
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
	if (!channelChatLogs[channelId]?.length) {
		const historicalMessages = await platformAPI.fetchChannelHistory(channelId, currentConfig.DefaultMaxFetchCount)
		const mergedHistoricalLog = mergeChatLogEntries(historicalMessages.sort((a, b) => a.time_stamp - b.time_stamp).slice(0, -1), currentConfig.MergeMessagePeriodMs)
		channelChatLogs[channelId] = mergedHistoricalLog
		while (channelChatLogs[channelId].length > currentConfig.DefaultMaxMessageDepth)
			channelChatLogs[channelId].shift()
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
				if (err.skip_auto_fix) throw error
				handleError(err, platformAPI, fountEntry)
			})
			.finally(() => {
				if (!channelMessageQueues[channelId]?.length)
					delete channelHandlers[channelId]
				else if (!channelHandlers[channelId])
					console.warn(`[BotLogic] Channel handler for ${channelId} was cleared, but queue is not empty. Not auto-restarting immediately.`)
			})
}

/**
 * 处理从接入层传入的新消息。
 * @async
 * @param {chatLogEntry_t_ext} fountEntry - 已经由接入层转换为 fount 格式的平台消息条目。
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
	}
	catch (error) {
		if (error.skip_auto_fix) throw error
		await handleError(error, platformAPI, fountEntry)
	}
}

/**
 * 处理从接入层传入的消息更新事件 (例如，消息被编辑)。
 * @async
 * @param {chatLogEntry_t_ext} updatedFountEntry - 包含更新信息的新的 fount 格式消息条目。
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
