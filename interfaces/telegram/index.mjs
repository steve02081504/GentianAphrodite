import { Buffer } from 'node:buffer'

import { processIncomingMessage, processMessageUpdate, cleanup as cleanupBotLogic, registerPlatformAPI } from '../../bot_core/index.mjs'
import { charname as BotFountCharname } from '../../charbase.mjs'

import { get_telegram_api_plugin } from './api.mjs'
import { telegramWorld } from './world.mjs'
import {
	splitTelegramReply,
	telegramEntitiesToAiMarkdown,
	aiMarkdownToTelegramHtml
} from './tools.mjs'
import { tryFewTimes } from '../../scripts/tryFewTimes.mjs'
import { mimetypeFromBufferAndName } from '../../scripts/mimetype.mjs'
import { escapeHTML } from '../../scripts/tools.mjs'

/**
 * Bot 逻辑层定义的平台 API 对象类型。
 * @typedef {import('../../bot_core/index.mjs').PlatformAPI_t} PlatformAPI_t
 */
/**
 * Bot 逻辑层定义的扩展聊天日志条目类型。
 * @typedef {import('../../bot_core/index.mjs').chatLogEntry_t_ext} chatLogEntry_t_ext
 */
/**
 * Fount 定义的聊天回复对象类型。
 * @typedef {import('../../../../../../../src/public/shells/chat/decl/chatLog.ts').FountChatReply_t} FountChatReply_t
 */
/** @typedef {import('npm:telegraf').Telegraf} TelegrafInstance */
/** @typedef {import('npm:telegraf').Context} TelegrafContext */
/** @typedef {import('npm:telegraf/typings/core/types/typegram').Message} TelegramMessageType */
/** @typedef {import('npm:telegraf/typings/core/types/typegram').UserFromGetMe} TelegramBotInfo */
/** @typedef {import('npm:telegraf/typings/core/types/typegram').User} TelegramUser */

/**
 * Telegram 接入层配置对象类型定义。
 * @typedef {{
 *  OwnerUserID: string,
 *  OwnerUserName: string,
 *  OwnerNameKeywords: string[],
 * }} TelegramInterfaceConfig_t
 */

/**
 * Telegraf 实例的引用。
 * @type {TelegrafInstance | null}
 */
let telegrafInstance = null

/**
 * Telegram Bot 自身的信息 (通过 getMe() 获取)。
 * @type {TelegramBotInfo | null}
 */
let telegramBotInfo = null

/**
 * Telegram 用户对象缓存。
 * 键为用户 ID (number)，值为 Telegram User 对象。
 * @type {Record<number, TelegramUser>}
 */
const telegramUserCache = {}

/**
 * Telegram 用户 ID到其规范化显示名称的映射。
 * 键为用户 ID (number)，值为用户显示名称 (string)。
 * @type {Record<number, string>}
 */
const telegramUserIdToDisplayName = {}

/**
 * Telegram 用户规范化显示名称到其用户 ID 的映射。
 * 键为显示名称 (string)，值为用户 ID (number)。
 * @type {Record<string, number>}
 */
const telegramDisplayNameToId = {}

/**
 * 缓存由 AI 生成并已发送的 FountChatReply_t 对象。
 * 键为第一条成功发送的 Telegram 消息的 ID (number)，值为原始的 {@link FountChatReply_t} 对象。
 * @type {Record<number, FountChatReply_t>}
 */
const aiReplyObjectCacheTg = {}

/**
 * 构造供 Bot 逻辑层使用的逻辑频道 ID。
 * 对于分区（topic），它组合了 chat.id 和 message_thread_id。
 * @param {string | number} chatId - Telegram 的 chat.id。
 * @param {number | undefined} threadId - Telegram 消息的 message_thread_id (如果存在)。
 * @returns {string} 逻辑频道 ID。
 */
function constructLogicalChannelId(chatId, threadId) {
	if (threadId !== undefined && threadId !== null)
		return `${chatId}_${threadId}`

	return String(chatId)
}

/**
 * Checks if the bot is mentioned in the message.
 * @param {string | undefined} rawText - The raw text of the message.
 * @param {TelegramMessageType} message - The Telegram message object.
 * @param {TelegramBotInfo | null} currentTelegramBotInfo - Information about the bot itself.
 * @param {string} botFountCharname - The bot's character name from Fount.
 * @returns {boolean} True if the bot is mentioned, false otherwise.
 */
function _checkIfBotIsMentioned(rawText, message, currentTelegramBotInfo, botFountCharname) {
	if (!currentTelegramBotInfo) return false
	if (currentTelegramBotInfo.username && rawText && rawText.toLowerCase().includes(`@${currentTelegramBotInfo.username.toLowerCase()}`))
		return true
	if (botFountCharname && rawText && rawText.toLowerCase().includes(botFountCharname.toLowerCase()))
		return true
	if (message.reply_to_message?.from?.id === currentTelegramBotInfo.id)
		return true
	return false
}

/**
 * Populates the extension object for a Fount chat log entry.
 * @param {TelegramMessageType} message - The Telegram message object.
 * @param {TelegramInterfaceConfig_t} interfaceConfig - The Telegram interface configuration.
 * @param {TelegramMessageType['chat']} chat - The chat object from the message.
 * @param {TelegramUser} fromUser - The user who sent the message.
 * @param {string} content - The processed message content.
 * @param {Array<object>} files - Array of processed file objects.
 * @param {boolean} isDirectMessage - Whether the message is a direct message.
 * @param {boolean} isFromOwner - Whether the message is from the owner.
 * @param {boolean} mentionsBot - Whether the bot is mentioned.
 * @param {boolean} mentionsOwner - Whether the owner is mentioned.
 * @param {object | undefined} cachedAiReplyExtension - The cached AI reply's extension object, if any.
 * @returns {object} The populated extension object.
 */
function _populateFountEntryExtension(
	message, interfaceConfig, chat, fromUser, content, files,
	isDirectMessage, isFromOwner, mentionsBot, mentionsOwner,
	cachedAiReplyExtension
) {
	return {
		platform: 'telegram',
		OwnerNameKeywords: interfaceConfig.OwnerNameKeywords,
		platform_message_ids: [message.message_id],
		content_parts: [content], // Assuming content is already prepared as a single part here
		platform_channel_id: chat.id,
		platform_user_id: fromUser.id,
		platform_chat_type: chat.type,
		platform_chat_title: chat.type !== 'private' ? chat.title : undefined,
		is_direct_message: isDirectMessage,
		is_from_owner: isFromOwner,
		mentions_bot: mentionsBot,
		mentions_owner: mentionsOwner,
		telegram_message_obj: message, // For potential deeper inspection by plugins or core
		...(message.message_thread_id && { telegram_message_thread_id: message.message_thread_id }),
		...(message.reply_to_message && { telegram_reply_to_message_id: message.reply_to_message.message_id }),
		...cachedAiReplyExtension, // Spread the cached extension if it exists
	}
}

/**
 * Helper function to determine the bot's display name.
 * @param {TelegramBotInfo} currentTelegramBotInfo - Information about the bot itself.
 * @param {string} currentBotFountCharname - The bot's character name from Fount.
 * @returns {string} The bot's display name.
 */
function _getBotDisplayName(currentTelegramBotInfo, currentBotFountCharname) {
	let botDisplayName = currentTelegramBotInfo.first_name || ''
	if (currentTelegramBotInfo.last_name) botDisplayName += ` ${currentTelegramBotInfo.last_name}`
	if (!botDisplayName.trim() && currentTelegramBotInfo.username) botDisplayName = currentTelegramBotInfo.username
	if (!botDisplayName.trim()) botDisplayName = currentBotFountCharname

	if (currentTelegramBotInfo.username && !botDisplayName.includes(`@${currentTelegramBotInfo.username}`))
		botDisplayName += ` (@${currentTelegramBotInfo.username})`
	return botDisplayName
}

/**
 * Helper function to process user information and update caches.
 * @param {TelegramUser} fromUser - The user object from the Telegram message.
 * @param {TelegramBotInfo | null} currentTelegramBotInfo - Information about the bot itself.
 * @param {string} currentBotFountCharname - The bot's character name from Fount.
 * @param {Record<number, TelegramUser>} userCache - Cache for Telegram user objects.
 * @param {Record<number, string>} userIdToNameMap - Map from user ID to display name.
 * @param {Record<string, number>} userNameToIdMap - Map from display name to user ID.
 * @returns {{senderName: string}}
 */
function _processUserInfo(fromUser, currentTelegramBotInfo, currentBotFountCharname, userCache, userIdToNameMap, userNameToIdMap) {
	userCache[fromUser.id] = fromUser

	let senderName = (fromUser.first_name || fromUser.last_name)
		? `${fromUser.first_name || ''} ${fromUser.last_name || ''}`.trim()
		: fromUser.username || `User_${fromUser.id}`

	if (fromUser.username && !senderName.includes(`@${fromUser.username}`)) {
		senderName += ` (@${fromUser.username})`
	}

	userIdToNameMap[fromUser.id] = senderName

	if (currentTelegramBotInfo && fromUser.id === currentTelegramBotInfo.id) {
		const botDisplayName = _getBotDisplayName(currentTelegramBotInfo, currentBotFountCharname)
		userNameToIdMap[botDisplayName.split(' (')[0]] = fromUser.id
		userNameToIdMap[currentBotFountCharname] = fromUser.id // Ensure BotFountCharname also maps to bot's ID
		userIdToNameMap[fromUser.id] = `${botDisplayName} (咱自己)`
		senderName = userIdToNameMap[fromUser.id]
	}
	return { senderName }
}

/**
 * Extracts a mentioned user ID from a Telegram message entity.
 * @param {import('npm:telegraf/typings/core/types/typegram').MessageEntity} entity - The message entity.
 * @param {string} rawText - The raw text of the message.
 * @param {TelegramInterfaceConfig_t} interfaceConfig - The Telegram interface configuration.
 * @returns {number | string | undefined} The mentioned user ID, or undefined if not found or not relevant.
 */
function _getMentionedUserIdFromEntity(entity, rawText, interfaceConfig) {
	if (entity.type === 'text_mention' && entity.user?.id) {
		return entity.user.id
	} else if (entity.type === 'mention') {
		const mentionText = rawText.substring(entity.offset, entity.offset + entity.length)
		if (mentionText === `@${interfaceConfig.OwnerUserName}` && interfaceConfig.OwnerUserID) {
			return Number(interfaceConfig.OwnerUserID)
		}
	}
	return undefined
}

/**
 * Detects mentions of the owner or the bot in a message.
 * @param {TelegramMessageType} message - The Telegram message object.
 * @param {string | undefined} rawText - The raw text of the message (message.text or message.caption).
 * @param {Array<import('npm:telegraf/typings/core/types/typegram').MessageEntity> | undefined} entities - Message entities.
 * @param {TelegramInterfaceConfig_t} interfaceConfig - The Telegram interface configuration.
 * @param {TelegramBotInfo | null} currentTelegramBotInfo - Information about the bot itself. // This param is named currentTelegramBotInfo to avoid conflict with global telegramBotInfo
 * @param {string} chatType - The type of the chat (e.g., 'private', 'group', 'supergroup').
 * @returns {{mentionsOwner: boolean, isReplyToOwnerTopicCreationMessage: boolean}}
 */
function _detectMentions(message, rawText, entities, interfaceConfig, currentTelegramBotInfo, chatType) {
	let mentionsOwner = false
	let isReplyToOwnerTopicCreationMessage = false

	if (entities && rawText) {
		for (const entity of entities) {
			const mentionedUserId = _getMentionedUserIdFromEntity(entity, rawText, interfaceConfig)
			if (mentionedUserId && String(mentionedUserId) === String(interfaceConfig.OwnerUserID)) {
				mentionsOwner = true
				// No break here, as a message could mention the owner multiple times or in different ways.
				// Also, the reply check below is separate.
			}
		}
	}

	// Check for replies to the owner
	if (message.reply_to_message?.from?.id === Number(interfaceConfig.OwnerUserID)) {
		const isReplyToOwnerTopicCreation =
			message.message_thread_id !== undefined &&
			message.reply_to_message.message_id === message.message_thread_id &&
			chatType !== 'private' // In groups/supergroups with topics, a reply to the topic creation message by the owner.

		if (isReplyToOwnerTopicCreation) {
			// This specific type of reply (to owner's topic creation message) does not by itself trigger 'mentionsOwner'
			// for AI context, as it's an indirect interaction.
			// It will only be true if the owner was also @mentioned in the message text (handled by the entity loop above).
			isReplyToOwnerTopicCreationMessage = true
		} else {
			// Any other type of reply to the owner is considered a direct mention.
			mentionsOwner = true
		}
	}

	return { mentionsOwner, isReplyToOwnerTopicCreationMessage }
}

/**
 * Extracts file name and MIME type from a Telegram message for a given file ID.
 * @param {TelegramMessageType} message - The Telegram message object.
 * @param {string} fileId - The file_id of the attachment.
 * @param {string} fileNameFallback - A fallback file name if not found in message.
 * @param {string} mimeTypeFallback - A fallback MIME type.
 * @returns {{fileName: string, mime_type: string}}
 */
function _extractFileInfo(message, fileId, fileNameFallback, mimeTypeFallback) {
	let fileName = fileNameFallback
	let mime_type = mimeTypeFallback // Default to fallback

	// Specific handling for document
	if (message.document && message.document.file_id === fileId) {
		fileName = message.document.file_name || fileNameFallback
		mime_type = message.document.mime_type || mimeTypeFallback
	}
	// Specific handling for audio
	else if (message.audio && message.audio.file_id === fileId) {
		fileName = message.audio.file_name || fileNameFallback
		mime_type = message.audio.mime_type || mimeTypeFallback
	}
	// Specific handling for video
	else if (message.video && message.video.file_id === fileId) {
		fileName = message.video.file_name || fileNameFallback
		mime_type = message.video.mime_type || mimeTypeFallback
	}
	// For photo, mime_type is often implicitly jpeg or known from context where addFile is called.
	// fileName will use fileNameFallback (e.g., unique_id.jpg)
	else if (message.photo && mimeTypeFallback === 'image/jpeg') { // Check if this call was for a photo
		mime_type = 'image/jpeg'
	}
	// Specific handling for voice
	else if (message.voice && message.voice.file_id === fileId) {
		// fileName will use fileNameFallback (e.g. unique_id.ogg)
		mime_type = message.voice.mime_type || 'audio/ogg'
	}
	return { fileName, mime_type }
}

const CAPTION_LENGTH_LIMIT = 1024 // Telegram's caption length limit

/**
 * Truncates a caption if it's too long, attempting multiple strategies.
 * @param {string | undefined} captionAiMarkdown - The caption in AI Markdown format.
 * @param {string} fileNameForDebug - The filename, used for logging if truncation occurs.
 * @returns {string | undefined} The processed HTML caption, or undefined if no caption.
 */
function _truncateCaption(captionAiMarkdown, fileNameForDebug) {
	if (!captionAiMarkdown) return undefined

	let finalCaptionHtml = aiMarkdownToTelegramHtml(captionAiMarkdown)

	if (finalCaptionHtml && finalCaptionHtml.length > CAPTION_LENGTH_LIMIT) {
		console.warn(`[TelegramInterface] HTML caption for file "${fileNameForDebug}" is too long (${finalCaptionHtml.length} > ${CAPTION_LENGTH_LIMIT}), will try to truncate.`)
		// Attempt to truncate the AI Markdown first, as it's more structured
		let truncatedCaptionAiMarkdown = ''
		if (captionAiMarkdown.length > CAPTION_LENGTH_LIMIT * 0.8) { // Heuristic: if raw MD is already long
			truncatedCaptionAiMarkdown = captionAiMarkdown.substring(0, Math.floor(CAPTION_LENGTH_LIMIT * 0.7)) + '...' // More aggressive truncation for MD
		} else {
			truncatedCaptionAiMarkdown = captionAiMarkdown // Hope that HTML conversion is the main cause of length increase
		}

		finalCaptionHtml = aiMarkdownToTelegramHtml(truncatedCaptionAiMarkdown)

		if (finalCaptionHtml.length > CAPTION_LENGTH_LIMIT) {
			// If still too long, fall back to plain text truncation (of original AI Markdown)
			const plainTextCaption = captionAiMarkdown.substring(0, CAPTION_LENGTH_LIMIT - 10) + '...' // Leave space for "..." and some HTML entities
			finalCaptionHtml = escapeHTML(plainTextCaption)
			console.warn(`[TelegramInterface] HTML caption for "${fileNameForDebug}" still too long after markdown truncation, falling back to plain text:`, plainTextCaption.substring(0, 50) + '...')
		}
	}
	return finalCaptionHtml
}

/**
 * Attempts to send a file using various Telegram methods based on MIME type.
 * If sending fails, it attempts to send a fallback text message.
 * @param {TelegrafInstance} bot - The Telegraf bot instance.
 * @param {string | number} platformChatId - The chat ID to send to.
 * @param {{source: Buffer, filename: string}} fileSource - The file source for Telegraf.
 * @param {object} sendOptions - Options for sending the file (includes caption).
 * @param {{name: string, mime_type?: string, description?: string}} file - The file object.
 * @param {string | undefined} captionAiMarkdown - Original AI Markdown caption for fallback.
 * @param {object} baseOptions - Base options for sending fallback message.
 * @param {number | undefined} messageThreadId - The message thread ID for context.
 * @returns {Promise<TelegramMessageType | undefined>} The sent message object or undefined.
 */
async function _trySendFileOrFallbackText(
	bot, platformChatId, fileSource, sendOptions,
	file, captionAiMarkdown, baseOptions, messageThreadId
) {
	let sentMsg
	try {
		if (file.mime_type?.startsWith('image/')) {
			sentMsg = await tryFewTimes(() => bot.telegram.sendPhoto(platformChatId, fileSource, sendOptions))
		} else if (file.mime_type?.startsWith('audio/')) {
			sentMsg = await tryFewTimes(() => bot.telegram.sendAudio(platformChatId, fileSource, { ...sendOptions, title: file.name }))
		} else if (file.mime_type?.startsWith('video/')) {
			sentMsg = await tryFewTimes(() => bot.telegram.sendVideo(platformChatId, fileSource, sendOptions))
		} else {
			sentMsg = await tryFewTimes(() => bot.telegram.sendDocument(platformChatId, fileSource, sendOptions))
		}
	} catch (e) {
		console.error(`[TelegramInterface] Failed to send file ${file.name} (ChatID: ${platformChatId}, ThreadID: ${messageThreadId}):`, e)
		const fallbackText = `[文件发送失败: ${file.name}] ${file.description || captionAiMarkdown || ''}`.trim()
		if (fallbackText) {
			try {
				sentMsg = await tryFewTimes(() => bot.telegram.sendMessage(platformChatId, escapeHTML(fallbackText.substring(0, 4000)), baseOptions))
			} catch (e2) {
				console.error('[TelegramInterface] Fallback message for failed file send also failed:', e2)
			}
		}
	}
	return sentMsg
}

/**
 * Processes and downloads files attached to a Telegram message.
 * @async
 * @param {TelegramMessageType} message - The Telegram message object.
 * @param {TelegrafContext | undefined} ctx - Telegraf context, if available.
 * @param {TelegrafInstance | null} globalTelegrafInstance - Globally available Telegraf instance.
 * @returns {Promise<Array<{name: string, buffer: Buffer, mime_type: string, description: string}>>} - Array of processed file objects.
 */
async function _processMessageFiles(message, ctx, globalTelegrafInstance) {
	const filesArr = [] // Renamed to avoid conflict with outer scope 'files' variable in some JS engines
	const fileDownloadPromises = []
	const telegrafAPI = ctx ? ctx.telegram : globalTelegrafInstance?.telegram

	const addFile = async (fileId, fileNameFallback, mimeTypeFallback, description = '') => {
		try {
			if (!telegrafAPI) {
				console.warn('[TelegramInterface:_processMessageFiles] Cannot download file: Telegraf API accessor not available.')
				return
			}

			const fileLink = await telegrafAPI.getFileLink(fileId)
			const response = await tryFewTimes(() => fetch(fileLink.href))
			if (!response.ok) throw new Error(`Failed to download file (ID: ${fileId}): ${response.statusText}`)
			const buffer = Buffer.from(await response.arrayBuffer())

			const { fileName, mime_type: extractedMimeType } = _extractFileInfo(message, fileId, fileNameFallback, mimeTypeFallback)

			const finalMimeType = extractedMimeType || await mimetypeFromBufferAndName(buffer, fileName)
			filesArr.push({ name: fileName, buffer, mime_type: finalMimeType, description })
		} catch (e) {
			console.error(`[TelegramInterface:_processMessageFiles] Failed to process file (ID: ${fileId}):`, e)
		}
	}

	try {
		if ('photo' in message && message.photo) {
			const photo = message.photo.reduce((prev, current) => (prev.file_size || 0) > (current.file_size || 0) ? prev : current)
			fileDownloadPromises.push(addFile(photo.file_id, `${photo.file_unique_id}.jpg`, 'image/jpeg', message.caption || '图片'))
		}
		if ('document' in message && message.document) {
			const doc = message.document
			fileDownloadPromises.push(addFile(doc.file_id, doc.file_name || `${doc.file_unique_id}`, doc.mime_type, message.caption || '文件'))
		}
		if ('voice' in message && message.voice) {
			const { voice } = message
			fileDownloadPromises.push(addFile(voice.file_id, `${voice.file_unique_id}.ogg`, voice.mime_type || 'audio/ogg', '语音消息'))
		}
		if ('audio' in message && message.audio) {
			const { audio } = message
			fileDownloadPromises.push(addFile(audio.file_id, audio.file_name || `${audio.file_unique_id}.${audio.mime_type?.split('/')[1] || 'mp3'}`, audio.mime_type, audio.title || '音频文件'))
		}
		if ('video' in message && message.video) {
			const { video } = message
			fileDownloadPromises.push(addFile(video.file_id, video.file_name || `${video.file_unique_id}.${video.mime_type?.split('/')[1] || 'mp4'}`, video.mime_type, message.caption || '视频文件'))
		}

		if (fileDownloadPromises.length > 0)
			await Promise.all(fileDownloadPromises)

	} catch (error) {
		console.error(`[TelegramInterface:_processMessageFiles] Top-level error occurred during file processing (MessageID ${message.message_id}):`, error)
	}
	return filesArr
}

/**
 * Prepares parameters for a reply message, adjusting content and options.
 * @param {chatLogEntry_t_ext | undefined} originalMessageEntry - The original message entry being replied to.
 * @param {string} aiMarkdownContent - The current AI-generated Markdown content.
 * @param {object} baseOptions - Base options for sending the message.
 * @returns {{aiMarkdownContent: string, baseOptions: object}} Updated content and options.
 */
function _prepareReplyParameters(originalMessageEntry, aiMarkdownContent, baseOptions) {
	let updatedAiMarkdownContent = aiMarkdownContent
	let updatedBaseOptions = { ...baseOptions } // Clone to avoid modifying the original object directly

	if (originalMessageEntry?.extension?.platform_message_ids?.slice?.(-1)?.[0]) {
		const replyToMessageId = originalMessageEntry.extension.platform_message_ids.slice(-1)[0]
		const fromUser = originalMessageEntry.extension.telegram_message_obj.from
		const mentionPatterns = [
			`@${fromUser.first_name} (@${fromUser.username})`,
			`@${fromUser.first_name}`,
			`@${fromUser.username}`,
		]

		for (const mention of mentionPatterns) {
			if (updatedAiMarkdownContent.startsWith(mention)) {
				updatedBaseOptions.reply_to_message_id = replyToMessageId
				updatedAiMarkdownContent = updatedAiMarkdownContent.slice(mention.length).trimStart() // Trim leading space after removing mention
				break
			}
		}
	}
	return { aiMarkdownContent: updatedAiMarkdownContent, baseOptions: updatedBaseOptions }
}

/**
 * Dispatches the message sending to the appropriate handler (_sendFiles or _sendTextMessages).
 * @param {TelegrafInstance} bot - The Telegraf bot instance.
 * @param {string | number} platformChatId - The chat ID to send to.
 * @param {number | undefined} messageThreadId - The message thread ID.
 * @param {object} baseOptions - Base options for sending the message (includes reply_to_message_id, etc.).
 * @param {Array<object>} files - Array of file objects to send.
 * @param {string} aiMarkdownContent - The AI-generated Markdown content.
 * @param {string} htmlContent - The HTML version of the content.
 * @returns {Promise<TelegramMessageType | null>} The first sent Telegram message object or null.
 */
async function _dispatchMessageSender(
	bot, platformChatId, messageThreadId, baseOptions,
	files, aiMarkdownContent, htmlContent
) {
	if (files.length > 0) {
		return await _sendFiles(bot, platformChatId, messageThreadId, baseOptions, files, aiMarkdownContent, htmlContent)
	} else if (htmlContent.trim()) {
		return await _sendTextMessages(bot, platformChatId, baseOptions, htmlContent)
	}
	return null // Should not happen if checks are done before calling, but as a safeguard
}

/**
 * 从逻辑频道 ID 解析出平台的 chat.id 和可选的 threadId。
 * @param {string | number} logicalChannelId - Bot逻辑层使用的频道ID。
 * @returns {{chatId: string, threadId?: number}} 包含平台 chatId 和可选的 threadId 的对象。
 */
function parseLogicalChannelId(logicalChannelId) {
	const idStr = String(logicalChannelId)
	if (idStr.includes('_')) {
		const parts = idStr.split('_')
		return { chatId: parts[0], threadId: parseInt(parts[1], 10) }
	}
	return { chatId: idStr }
}

/**
 * 获取此 Telegram 接口的配置模板。
 * @returns {TelegramInterfaceConfig_t} 配置模板对象。
 */
export function GetBotConfigTemplate() {
	return {
		OwnerUserID: 'YOUR_TELEGRAM_USER_ID',
		OwnerUserName: 'YOUR_TELEGRAM_USERNAME',
		OwnerNameKeywords: [
			'your_name_keyword1',
			'your_name_keyword2',
		],
	}
}

/**
 * 将 Telegram 消息上下文转换为 Bot 逻辑层可以理解的 Fount 聊天日志条目格式。
 * @async
 * @param {TelegrafContext | TelegrafInstance} ctxOrBotInstance - Telegraf 的消息上下文或 Telegraf 实例。
 * @param {TelegramMessageType} message - 从上下文中提取的 Telegram 消息对象。
 * @param {TelegramInterfaceConfig_t} interfaceConfig - 当前 Telegram 接口的配置对象。
 * @returns {Promise<chatLogEntry_t_ext | null>} 转换后的 Fount 聊天日志条目，或在无法处理时返回 null。
 */
async function telegramMessageToFountChatLogEntry(ctxOrBotInstance, message, interfaceConfig) {
	if (!message || !message.from) return null

	const fromUser = message.from
	const { chat } = message
	const ctx = 'telegram' in ctxOrBotInstance && typeof ctxOrBotInstance.telegram === 'object' ? ctxOrBotInstance : undefined

	const { senderName } = _processUserInfo(fromUser, telegramBotInfo, BotFountCharname, telegramUserCache, telegramUserIdToDisplayName, telegramDisplayNameToId)

	const rawText = message.text || message.caption // Keep rawText and entities for _detectMentions and content processing
	const entities = message.entities || message.caption_entities

	const { mentionsOwner, isReplyToOwnerTopicCreationMessage } = _detectMentions(message, rawText, entities, interfaceConfig, telegramBotInfo, chat.type)

	// This console.log can be moved into _detectMentions if preferred, or stay here.
	// For now, keeping it here as _detectMentions primarily focuses on returning the boolean states.
	if (isReplyToOwnerTopicCreationMessage)
		console.log(`[TelegramInterface] Identified a reply to owner's topic creation message. Message ID: ${message.message_id}, Replied To Message ID: ${message.reply_to_message.message_id}, Thread ID: ${message.message_thread_id}. This will NOT trigger 'mentions_owner' for AI context if not also an @mention.`)


	const replyToMessageForAiPrompt = isReplyToOwnerTopicCreationMessage ? undefined : message.reply_to_message
	const content = telegramEntitiesToAiMarkdown(rawText, entities, telegramBotInfo || undefined, replyToMessageForAiPrompt)

	const files = await _processMessageFiles(message, ctx, telegrafInstance) // Corrected call

	if (!content.trim() && files.length === 0)
		return null

	const isDirectMessage = chat.type === 'private'
	const isFromOwner = String(fromUser.id) === String(interfaceConfig.OwnerUserID)

	const mentionsBot = _checkIfBotIsMentioned(rawText, message, telegramBotInfo, BotFountCharname)

	/** @type {chatLogEntry_t_ext} */
	const fountEntry = {
		time_stamp: message.edit_date ? message.edit_date * 1000 : message.date * 1000,
		role: isFromOwner ? 'user' : 'char',
		name: senderName,
		content,
		files,
		extension: _populateFountEntryExtension(
			message, interfaceConfig, chat, fromUser, content, files,
			isDirectMessage, isFromOwner, mentionsBot, mentionsOwner,
			aiReplyObjectCacheTg[message.message_id]?.extension
		)
	}
	delete aiReplyObjectCacheTg[message.message_id]
	return fountEntry
}

/**
 * Telegram Bot 的主设置和事件处理函数。
 * @param {TelegrafInstance} bot - 已初始化的 Telegraf 实例。
 * @param {TelegramInterfaceConfig_t} interfaceConfig - 传递给此 Telegram 接口的特定配置对象。
 * @returns {Promise<void>}
 */
export async function TelegramBotMain(bot, interfaceConfig) {
	telegrafInstance = bot
	try {
		telegramBotInfo = await tryFewTimes(() => bot.telegram.getMe())
	} catch (error) {
		console.error('[TelegramInterface] 无法获取机器人自身信息 (getMe):', error)
		throw new Error('机器人初始化失败: 无法连接到 Telegram 或获取机器人信息。')
	}

	if (telegramBotInfo) {
		const botUserId = telegramBotInfo.id
		let botDisplayName = telegramBotInfo.first_name || telegramBotInfo.username || BotFountCharname
		if (telegramBotInfo.username && !botDisplayName.includes(`@${telegramBotInfo.username}`))
			botDisplayName += ` (@${telegramBotInfo.username})`

		telegramUserIdToDisplayName[botUserId] = `${botDisplayName} (咱自己)`
		telegramDisplayNameToId[botDisplayName.split(' (')[0]] = botUserId
		if (BotFountCharname) telegramDisplayNameToId[BotFountCharname] = botUserId
	}

	async function _sendFiles(bot, platformChatId, messageThreadId, baseOptions, files, aiMarkdownContent, htmlContent) {
		let firstSentTelegramMessage = null
		let mainTextSentAsCaption = false

		const sendFileWithCaption = async (file, captionAiMarkdown, isLastFile) => {
			let sentMsg
			const fileSource = { source: file.buffer, filename: file.name }
			const finalCaptionHtml = _truncateCaption(captionAiMarkdown, file.name)
			const sendOptions = { ...baseOptions, caption: finalCaptionHtml }

			sentMsg = await _trySendFileOrFallbackText(
				bot, platformChatId, fileSource, sendOptions,
				file, captionAiMarkdown, baseOptions, messageThreadId
			)
			return sentMsg
		}

		for (let i = 0; i < files.length; i++) {
			const file = files[i]
			const isLastFile = i === files.length - 1
			let captionForThisFileAiMarkdown = file.description

			if (isLastFile && aiMarkdownContent.trim()) {
				captionForThisFileAiMarkdown = aiMarkdownContent
				mainTextSentAsCaption = true
			} else if (!captionForThisFileAiMarkdown && aiMarkdownContent.trim() && files.length === 1) {
				captionForThisFileAiMarkdown = aiMarkdownContent
				mainTextSentAsCaption = true
			}
			const sentMsg = await sendFileWithCaption(file, captionForThisFileAiMarkdown, isLastFile)
			if (sentMsg && !firstSentTelegramMessage)
				firstSentTelegramMessage = sentMsg

		}

		if (!mainTextSentAsCaption && htmlContent.trim()) {
			const remainingHtmlParts = splitTelegramReply(htmlContent, 4096)
			for (const part of remainingHtmlParts)
				try {
					const sentMsg = await tryFewTimes(() => bot.telegram.sendMessage(platformChatId, part, baseOptions))
					if (sentMsg && !firstSentTelegramMessage)
						firstSentTelegramMessage = sentMsg

				} catch (e) {
					console.error(`[TelegramInterface] Failed to send remaining HTML text (ChatID: ${platformChatId}, ThreadID: ${messageThreadId}):`, e)
				}

		}
		return firstSentTelegramMessage
	}

	async function _sendTextMessages(bot, platformChatId, baseOptions, htmlContent) {
		let firstSentTelegramMessage = null
		if (htmlContent.trim()) {
			const textParts = splitTelegramReply(htmlContent, 4096)
			for (const part of textParts)
				try {
					const sentMsg = await tryFewTimes(() => bot.telegram.sendMessage(platformChatId, part, baseOptions))
					if (sentMsg && !firstSentTelegramMessage)
						firstSentTelegramMessage = sentMsg

				} catch (e) {
					console.error(`[TelegramInterface] Failed to send HTML text message (ChatID: ${platformChatId}, ThreadID: ${baseOptions.message_thread_id}):`, e)
				}

		}
		return firstSentTelegramMessage
	}

	/** @type {PlatformAPI_t} */
	const telegramPlatformAPI = {
		name: 'telegram',
		config: interfaceConfig,

		async sendMessage(logicalChannelId, fountReplyPayload, originalMessageEntry) {
			const { chatId, threadId: threadIdFromLogicalId } = parseLogicalChannelId(logicalChannelId)
			const platformChatId = chatId

			let aiMarkdownContent = fountReplyPayload.content || ''
			const files = fountReplyPayload.files || []
			const parseMode = 'HTML'

			const replyToMessageId = originalMessageEntry?.extension?.platform_message_ids?.slice?.(-1)?.[0]
			const messageThreadId = originalMessageEntry?.extension?.telegram_message_thread_id || threadIdFromLogicalId

			const htmlContent = aiMarkdownToTelegramHtml(aiMarkdownContent)

			let firstSentTelegramMessage = null
			let currentAiMarkdownContent = aiMarkdownContent // Use a new variable for modifications
			const initialBaseOptions = {
				parse_mode: parseMode,
				...(messageThreadId && { message_thread_id: messageThreadId })
			}

			// Prepare reply parameters if it's a reply
			const { aiMarkdownContent: finalAiMarkdownContent, baseOptions: finalBaseOptions } = _prepareReplyParameters(originalMessageEntry, currentAiMarkdownContent, initialBaseOptions)
			// Use finalAiMarkdownContent and finalBaseOptions for sending
			aiMarkdownContent = finalAiMarkdownContent

			firstSentTelegramMessage = await _dispatchMessageSender(
				bot, platformChatId, messageThreadId, finalBaseOptions,
				files, aiMarkdownContent, htmlContent
			)

			if (firstSentTelegramMessage) {
				if (fountReplyPayload && (fountReplyPayload.content || fountReplyPayload.files?.length))
					aiReplyObjectCacheTg[firstSentTelegramMessage.message_id] = fountReplyPayload

				const botInstanceForConversion = telegrafInstance || bot
				return await telegramMessageToFountChatLogEntry(botInstanceForConversion, firstSentTelegramMessage, interfaceConfig)
			}
			return null
		},

		async sendTyping(logicalChannelId, originalMessageEntry) {
			const { chatId, threadId: threadIdFromLogicalId } = parseLogicalChannelId(logicalChannelId)
			const platformChatId = chatId
			try {
				const messageThreadId = originalMessageEntry?.extension?.telegram_message_thread_id || threadIdFromLogicalId
				await bot.telegram.sendChatAction(platformChatId, 'typing', {
					...messageThreadId && { message_thread_id: messageThreadId }
				})
			} catch (e) { /* 静默处理，发送typing指示失败不应中断流程 */ }
		},

		async fetchChannelHistory(logicalChannelId, limit) {
			const { chatId, threadId } = parseLogicalChannelId(logicalChannelId)
			console.warn(`[TelegramInterface] fetchChannelHistory not fully implemented in Telegram interface (LogicalID: ${logicalChannelId}, PlatformChatID: ${chatId}, ThreadID: ${threadId}). Relying on in-memory logs.`)
			return []
		},

		getBotUserId: () => telegramBotInfo ? telegramBotInfo.id : -1,
		getBotUsername: () => telegramBotInfo ? telegramBotInfo.username || BotFountCharname : 'UnknownBot',
		getBotDisplayName: () => telegramBotInfo ? telegramUserIdToDisplayName[telegramBotInfo.id] || telegramBotInfo.first_name || telegramBotInfo.username || BotFountCharname : 'Unknown Bot',

		getOwnerUserName: () => interfaceConfig.OwnerUserName,
		getOwnerUserId: () => interfaceConfig.OwnerUserID,

		getChatNameForAI: (logicalChannelId, triggerMessage) => {
			const { threadId } = parseLogicalChannelId(logicalChannelId)

			const chatType = triggerMessage?.extension?.platform_chat_type
			const chatTitle = triggerMessage?.extension?.platform_chat_title

			if (chatType === 'private') {
				const fromUser = triggerMessage?.extension?.telegram_message_obj?.from
				let userName = ''
				if (fromUser) {
					userName = fromUser.first_name || ''
					if (fromUser.last_name) userName += ` ${fromUser.last_name}`
					if (!userName.trim() && fromUser.username) userName = fromUser.username
					if (!userName.trim()) userName = String(fromUser.id)
				}
				return `Telegram DM with ${userName || 'Some User'}`
			} else if (chatTitle) {
				let baseName = `Telegram: Group ${chatTitle.replace(/\s/g, '_')}`
				const actualThreadId = triggerMessage?.extension?.telegram_message_thread_id || threadId
				if (actualThreadId)
					baseName += `: Thread ${actualThreadId}`

				return baseName
			}
			return `Telegram: Chat ${logicalChannelId}`
		},

		destroySelf: async () => {
			await cleanupBotLogic()
			if (telegrafInstance)
				telegrafInstance.stop('SIGINT')

		},

		/**
		 * (可选) 获取群组/服务器的默认或合适的首选频道。
		 * @param {string | number} chatId - 群组的 ID。
		 * @returns {Promise<import('../../bot_core/index.mjs').ChannelObject | null>}
		 */
		getGroupDefaultChannel: async (chatId) => {
			if (!telegrafInstance) {
				console.error('[TelegramInterface] getGroupDefaultChannel: Telegraf instance not available.')
				return null
			}
			try {
				const chat = await telegrafInstance.telegram.getChat(String(chatId))
				/** @type {import('../../bot_core/index.mjs').ChannelObject} */
				const channelObject = {
					id: chat.id,
					name: chat.title || `Group ${chat.id}`,
					type: chat.type,
					telegramChat: chat
				}
				return channelObject
			} catch (error) {
				console.error(`[TelegramInterface] Error getting chat info for ${chatId}:`, error)
				return null
			}
		},

		logError: (error, contextMessage) => {
			console.error('[TelegramInterface-PlatformAPI-Error]', error, contextMessage ? `Context: ${JSON.stringify(contextMessage)}` : '')
		},

		getPlatformSpecificPlugins: (messageEntry) => {
			if (messageEntry?.extension?.telegram_message_obj && telegrafInstance)
				return {
					telegram_api: get_telegram_api_plugin(telegrafInstance, messageEntry.extension.telegram_message_obj),
				}

			return {}
		},

		getPlatformWorld: () => telegramWorld,

		/**
		 * (可选) 设置当机器人加入新群组/服务器时调用的回调函数。
		 * @param {(group: import('../../bot_core/index.mjs').GroupObject) => Promise<void>} onJoinCallback - 回调函数。
		 */
		onGroupJoin: (onJoinCallback) => {
			if (telegrafInstance && typeof onJoinCallback === 'function')
				telegrafInstance.on('my_chat_member', async (ctx) => {
					const oldStatus = ctx.myChatMember.old_chat_member.status
					const newStatus = ctx.myChatMember.new_chat_member.status
					const { chat } = ctx.myChatMember

					if ((oldStatus === 'left' || oldStatus === 'kicked' || oldStatus === 'restricted') &&
						(newStatus === 'member' || newStatus === 'administrator') &&
						(chat.type === 'group' || chat.type === 'supergroup')) {
						console.log(`[TelegramInterface] Joined new group: ${chat.title} (ID: ${chat.id})`)
						/** @type {import('../../bot_core/index.mjs').GroupObject} */
						const groupObject = {
							id: chat.id,
							name: chat.title || `Group ${chat.id}`,
							telegramChat: chat
						}
						try {
							await onJoinCallback(groupObject)
						} catch (e) {
							console.error(`[TelegramInterface] Error in onGroupJoin callback for chat ${chat.id}:`, e)
						}
					}
				})
			else
				console.error('[TelegramInterface] Could not set onGroupJoin: bot instance or callback invalid.')
		},

		/**
		 * (可选) 获取机器人当前所在的所有群组/服务器列表。
		 * @returns {Promise<import('../../bot_core/index.mjs').GroupObject[]>}
		 */
		getJoinedGroups: async () => {
			console.warn('[TelegramInterface] getJoinedGroups is not reliably supported by Telegram Bot API. It may return an empty list or only previously known chats.')
			return Promise.resolve([])
		},

		/**
		 * (可选) 获取特定群组/服务器的成员列表。
		 * @param {string | number} chatId - 群组的 ID。
		 * @returns {Promise<import('../../bot_core/index.mjs').UserObject[]>}
		 */
		getGroupMembers: async (chatId) => {
			console.warn('[TelegramInterface] getGroupMembers on Telegram primarily returns administrators or a limited set of members due to API restrictions.')
			if (!telegrafInstance) {
				console.error('[TelegramInterface] getGroupMembers: Telegraf instance not available.')
				return []
			}
			try {
				const administrators = await telegrafInstance.telegram.getChatAdministrators(String(chatId))
				return administrators.map(admin => ({
					id: admin.user.id,
					username: admin.user.username || `User${admin.user.id}`,
					isBot: admin.user.is_bot,
					telegramUser: admin.user
				}))
			} catch (error) {
				console.error(`[TelegramInterface] Error fetching group administrators for chat ${chatId}:`, error)
				return []
			}
		},

		/**
		 * (可选) 为指定群组/服务器生成邀请链接。
		 * @param {string | number} chatId - 群组的 ID。
		 * @param {string | number} [threadId] - (可选) 用于生成邀请链接的话题 ID。
		 * @returns {Promise<string | null>} 邀请 URL 或 null。
		 */
		generateInviteLink: async (chatId, threadId) => {
			if (!telegrafInstance) {
				console.error('[TelegramInterface] generateInviteLink: Telegraf instance not available.')
				return null
			}
			try {
				const link = await telegrafInstance.telegram.exportChatInviteLink(String(chatId))
				return link
			} catch (e) {
				console.error(`[TelegramInterface] Failed to generate invite link for ${chatId}:`, e)
				return null
			}
		},

		/**
		 * (可选) 使机器人离开指定群组/服务器。
		 * @param {string | number} chatId - 群组的 ID。
		 * @returns {Promise<void>}
		 */
		leaveGroup: async (chatId) => {
			if (!telegrafInstance) {
				console.error('[TelegramInterface] leaveGroup: Telegraf instance not available.')
				return
			}
			try {
				await telegrafInstance.telegram.leaveChat(String(chatId))
			} catch (error) {
				console.error(`[TelegramInterface] Error leaving group ${chatId}:`, error)
			}
		},

		/**
		 * (可选) 优化方法：一次性获取主人在哪些群组中、不在哪些群组中。
		 * @returns {Promise<{groupsWithOwner: import('../../bot_core/index.mjs').GroupObject[], groupsWithoutOwner: import('../../bot_core/index.mjs').GroupObject[]} | null>}
		 */
		getOwnerPresenceInGroups: async () => {
			console.warn('[TelegramInterface] getOwnerPresenceInGroups is not supported by the Telegram Bot API due to privacy restrictions and API limitations. This method will return null, and the system should fall back to other methods for startup checks if applicable.')
			return null
		},

		/**
		 * (可选) 设置当主人离开群组时调用的回调函数。
		 * @param {(groupId: string | number, userId: string | number) => Promise<void>} onLeaveCallback - 回调函数。
		 */
		onOwnerLeaveGroup: (onLeaveCallback) => {
			if (!telegrafInstance) {
				console.error('[TelegramInterface] onOwnerLeaveGroup: Telegraf instance not initialized.')
				return
			}
			if (typeof onLeaveCallback !== 'function') {
				console.error('[TelegramInterface] onOwnerLeaveGroup: Invalid callback provided.')
				return
			}

			telegrafInstance.on('chat_member', async (ctx) => {
				const chatMemberUpdate = ctx.update.chat_member
				if (!chatMemberUpdate || !chatMemberUpdate.chat || !chatMemberUpdate.new_chat_member || !chatMemberUpdate.old_chat_member) {
					console.warn('[TelegramInterface] chat_member event triggered with incomplete data.')
					return
				}

				const oldStatus = chatMemberUpdate.old_chat_member.status
				const newStatus = chatMemberUpdate.new_chat_member.status
				const userId = chatMemberUpdate.new_chat_member.user.id
				const chatId = chatMemberUpdate.chat.id

				if ((oldStatus === 'member' || oldStatus === 'administrator' || oldStatus === 'creator') &&
					(newStatus === 'left' || newStatus === 'kicked'))
					try {
						await onLeaveCallback(String(chatId), String(userId))
					} catch (e) {
						console.error(`[TelegramInterface] Error in onOwnerLeaveGroup callback for user ${userId} in chat ${chatId}:`, e)
					}

			})
		},

		/**
		 * (可选) 向配置的机器人主人发送私信。
		 * @param {string} messageText - 要发送的消息文本。
		 * @returns {Promise<void>}
		 */
		sendDirectMessageToOwner: async (messageText) => {
			if (!telegrafInstance) {
				console.error('[TelegramInterface] sendDirectMessageToOwner: Telegraf instance not available.')
				return
			}
			if (!interfaceConfig.OwnerUserID) {
				console.error('[TelegramInterface] sendDirectMessageToOwner: OwnerUserID is not configured.')
				return
			}
			try {
				const ownerIdNumber = Number(interfaceConfig.OwnerUserID)
				if (isNaN(ownerIdNumber)) {
					console.error('[TelegramInterface] sendDirectMessageToOwner: OwnerUserID is not a valid number.')
					return
				}
				await telegrafInstance.telegram.sendMessage(ownerIdNumber, messageText, { parse_mode: 'HTML' })
			} catch (error) {
				console.error(`[TelegramInterface] Error sending DM to owner (ID: ${interfaceConfig.OwnerUserID}):`, error)
			}
		}
	}

	telegrafInstance.on('message', async (ctx) => {
		if ('message' in ctx.update) {
			const { message } = ctx.update
			const fountEntry = await telegramMessageToFountChatLogEntry(ctx, message, interfaceConfig)
			if (fountEntry) {
				const logicalChanId = constructLogicalChannelId(message.chat.id, message.message_thread_id)
				await processIncomingMessage(fountEntry, telegramPlatformAPI, logicalChanId)
			}
		}
	})

	telegrafInstance.on('edited_message', async (ctx) => {
		if ('edited_message' in ctx.update) {
			const message = ctx.update.edited_message
			const fountEntry = await telegramMessageToFountChatLogEntry(ctx, message, interfaceConfig)
			if (fountEntry) {
				const logicalChanId = constructLogicalChannelId(message.chat.id, message.message_thread_id)
				await processMessageUpdate(fountEntry, telegramPlatformAPI, logicalChanId)
			}
		}
	})

	await registerPlatformAPI(telegramPlatformAPI)
	return telegramPlatformAPI
}
