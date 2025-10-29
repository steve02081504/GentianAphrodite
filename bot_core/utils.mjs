import { charname as BotCharname } from '../charbase.mjs'

import { userIdToNameMap, nameToUserIdMap } from './state.mjs'

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
 * 平台接口 API 对象类型定义。
 * @typedef {import('./index.mjs').PlatformAPI_t} PlatformAPI_t
 */

/**
 * 更新机器人自身在特定平台上的名称映射 (ID到名称，名称到ID)。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 */
export function updateBotNameMapping(platformAPI) {
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
 * @param {number} mergeMessagePeriodMs - 合并消息的时间窗口（毫秒）。
 * @returns {chatLogEntry_t_ext[]} 合并后的聊天记录条目数组。
 */
export function mergeChatLogEntries(logEntries, mergeMessagePeriodMs) {
	if (!logEntries?.length) return []
	const newLog = []
	let lastEntry = { ...logEntries[0], extension: { ...logEntries[0].extension, platform_message_ids: [...logEntries[0].extension?.platform_message_ids || []] } }

	for (let i = 1; i < logEntries.length; i++) {
		const currentEntry = logEntries[i]
		if (
			lastEntry.name === currentEntry.name &&
			currentEntry.time_stamp - lastEntry.time_stamp < mergeMessagePeriodMs &&
			!lastEntry.files?.length
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
		}
		else {
			newLog.push(lastEntry)
			lastEntry = { ...currentEntry, extension: { ...currentEntry.extension, platform_message_ids: [...currentEntry.extension?.platform_message_ids || []] } }
		}
	}
	newLog.push(lastEntry)
	return newLog
}

/**
 * 检查字符串是否为机器人命令。
 * @param {string} str - 要检查的字符串。
 * @returns {boolean} 如果是命令则返回 true。
 */
export function isBotCommand(str) {
	return Boolean(str.match(/^[!$%&/\\！]/))
}

/**
 * 更新用户缓存（ID到名称和名称到ID的映射）。
 * @param {string | number | undefined} senderId - 发送者 ID。
 * @param {string | undefined} senderName - 发送者名称。
 */
export function updateUserCache(senderId, senderName) {
	if (senderId && senderName) {
		if (!userIdToNameMap[senderId] || userIdToNameMap[senderId] !== senderName)
			userIdToNameMap[senderId] = senderName

		if (!nameToUserIdMap[senderName] || nameToUserIdMap[senderName] !== senderId)
			nameToUserIdMap[senderName] = senderId

	}
}

/**
 * 异步获取文件，解析输入数组中的任何函数。
 * @param {Array<Function | any>} files - 文件或返回文件的函数数组。
 * @returns {Promise<Array<any>>} 一个解析为成功获取的文件数组的 Promise。
 */
export async function fetchFiles(files) {
	files = await Promise.allSettled(files.map(file => Object(file) instanceof Function ? file() : file))
	return files.filter(file => file.status === 'fulfilled' && file.value).map(file => file.value)
}

/**
 * 为输入的消息数组获取文件。
 * @param {chatLogEntry_t_ext[]} messages - 消息数组。
 * @returns {Promise<chatLogEntry_t_ext[]>} 一个解析为相同消息数组的 Promise，但其中任何文件 Promise 都已解析。
 */
export async function fetchFilesForMessages(messages) {
	for (const message of messages)
		if (message.files) message.files = await fetchFiles(message.files)
	return messages
}
