import { charname as BotCharname, username as FountUsername } from '../charbase.mjs'
import GentianAphrodite from '../main.mjs'
import { localhostLocales } from '../../../../../../src/scripts/i18n.mjs'
import { channelChatLogs, channelLastSendMessageTime, channelCharScopedMemory, userIdToNameMap, bannedStrings, fuyanMode, setInHypnosisChannelId } from './state.mjs'
import { handleError } from './error.mjs'
import { fetchFilesForMessages, updateBotNameMapping } from './utils.mjs'
import { loadDefaultPersona } from '../../../../../../src/server/managers/persona_manager.mjs'

/**
 * Fount 聊天回复对象类型。
 * @typedef {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatReply_t} FountChatReply_t
 */

/**
 * Fount 聊天回复请求对象类型。
 * @typedef {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatReplyRequest_t} FountChatReplyRequest_t
 */

/**
 * 平台接口 API 对象类型定义。
 * @typedef {import('./index.mjs').PlatformAPI_t} PlatformAPI_t
 */

/**
 * 扩展的 Fount 聊天日志条目类型，包含平台特定信息。
 * @typedef {import('./state.mjs').chatLogEntry_t_ext} chatLogEntry_t_ext
 */

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
 * @returns {Promise<FountChatReplyRequest_t>} 构建好的回复请求对象。
 */
async function buildReplyRequest(triggerMessage, platformAPI, channelId, requestData) {
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
		user: loadDefaultPersona(FountUsername),
		char: GentianAphrodite,
		other_chars: [],
		plugins: activePlugins,
		chat_scoped_char_memory: channelCharScopedMemory[channelId],
		chat_log: await fetchFilesForMessages(currentChannelChatLog),
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
		setInHypnosisChannelId(channelId)
	else
		setInHypnosisChannelId(null)


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
export async function doMessageReply(triggerMessage, platformAPI, channelId) {
	let typingInterval = setInterval(() => { platformAPI.sendTyping(channelId).catch(() => { }) }, 5000)
	function clearTypingInterval() {
		if (typingInterval) typingInterval = clearInterval(typingInterval)
	}

	updateBotNameMapping(platformAPI)

	try {
		const requestData = await prepareReplyRequestData(triggerMessage, platformAPI, channelId)
		const replyRequest = await buildReplyRequest(triggerMessage, platformAPI, channelId, requestData)
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
export async function sendAndLogReply(replyToSend, platformAPI, channelId, repliedToMessageEntry) {
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
