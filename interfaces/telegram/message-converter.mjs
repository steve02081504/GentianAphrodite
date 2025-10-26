import { Buffer } from 'node:buffer'

import { charname as BotFountCharname } from '../../charbase.mjs'
import { mimetypeFromBufferAndName } from '../../scripts/mimetype.mjs'
import { tryFewTimes } from '../../scripts/tryFewTimes.mjs'

import { telegrafInstance, telegramBotInfo, telegramUserCache, telegramUserIdToDisplayName, telegramDisplayNameToId, aiReplyObjectCache } from './state.mjs'
import { telegramEntitiesToAiMarkdown } from './utils.mjs'

/**
 * @typedef {import('./config.mjs').TelegramInterfaceConfig_t} TelegramInterfaceConfig_t
 */
/**
 * @typedef {import('../../bot_core/index.mjs').chatLogEntry_t_ext} chatLogEntry_t_ext
 */
/** @typedef {import('npm:telegraf').Context} TelegrafContext */
/** @typedef {import('npm:telegraf/typings/core/types/typegram').Message} TelegramMessageType */
/** @typedef {import('npm:telegraf/typings/core/types/typegram').User} TelegramUser */

/**
 * 检查机器人是否在消息中被提及。
 * @param {string | undefined} rawText
 * @param {TelegramMessageType} message
 * @returns {boolean}
 */
function checkIfBotIsMentioned(rawText, message) {
	if (!telegramBotInfo) return false
	if (telegramBotInfo.username && rawText && rawText.toLowerCase().includes(`@${telegramBotInfo.username.toLowerCase()}`))
		return true
	if (BotFountCharname && rawText && rawText.toLowerCase().includes(BotFountCharname.toLowerCase()))
		return true
	if (message.reply_to_message?.from?.id === telegramBotInfo.id)
		return true
	return false
}

/**
 * 辅助函数，用于确定机器人的显示名称。
 * @returns {string}
 */
function getBotDisplayName() {
	let botDisplayName = telegramBotInfo.first_name || ''
	if (telegramBotInfo.last_name) botDisplayName += ` ${telegramBotInfo.last_name}`
	if (!botDisplayName.trim() && telegramBotInfo.username) botDisplayName = telegramBotInfo.username
	if (!botDisplayName.trim()) botDisplayName = BotFountCharname

	if (telegramBotInfo.username && !botDisplayName.includes(`@${telegramBotInfo.username}`))
		botDisplayName += ` (@${telegramBotInfo.username})`
	return botDisplayName
}

/**
 * 辅助函数，用于处理用户信息并更新缓存。
 * @param {TelegramUser} fromUser
 * @returns {{senderName: string}}
 */
function processUserInfo(fromUser) {
	telegramUserCache[fromUser.id] = fromUser

	let senderName = fromUser.first_name || fromUser.last_name
		? `${fromUser.first_name || ''} ${fromUser.last_name || ''}`.trim()
		: fromUser.username || `User_${fromUser.id}`

	if (fromUser.username && !senderName.includes(`@${fromUser.username}`))
		senderName += ` (@${fromUser.username})`

	telegramUserIdToDisplayName[fromUser.id] = senderName

	if (telegramBotInfo && fromUser.id === telegramBotInfo.id) {
		const botDisplayName = getBotDisplayName()
		telegramDisplayNameToId[botDisplayName.split(' (')[0]] = fromUser.id
		telegramDisplayNameToId[BotFountCharname] = fromUser.id
		telegramUserIdToDisplayName[fromUser.id] = `${botDisplayName} (咱自己)`
		senderName = telegramUserIdToDisplayName[fromUser.id]
	}
	return { senderName }
}

/**
 * 从 Telegram 消息实体中提取被提及用户的 ID。
 * @param {import('npm:telegraf/typings/core/types/typegram').MessageEntity} entity
 * @param {string} rawText
 * @param {TelegramInterfaceConfig_t} interfaceConfig
 * @returns {number | string | undefined}
 */
function getMentionedUserIdFromEntity(entity, rawText, interfaceConfig) {
	if (entity.type === 'text_mention' && entity.user?.id)
		return entity.user.id
	else if (entity.type === 'mention') {
		const mentionText = rawText.substring(entity.offset, entity.offset + entity.length)
		if (mentionText === `@${interfaceConfig.OwnerUserName}` && interfaceConfig.OwnerUserID)
			return Number(interfaceConfig.OwnerUserID)
	}
	return undefined
}

/**
 * 检测消息中对主人或机器人的提及。
 * @param {TelegramMessageType} message
 * @param {string | undefined} rawText
 * @param {Array<import('npm:telegraf/typings/core/types/typegram').MessageEntity> | undefined} entities
 * @param {TelegramInterfaceConfig_t} interfaceConfig
 * @param {string} chatType
 * @returns {{mentionsOwner: boolean, isReplyToOwnerTopicCreationMessage: boolean}}
 */
function detectMentions(message, rawText, entities, interfaceConfig, chatType) {
	let mentionsOwner = false
	let isReplyToOwnerTopicCreationMessage = false

	if (entities && rawText)
		for (const entity of entities) {
			const mentionedUserId = getMentionedUserIdFromEntity(entity, rawText, interfaceConfig)
			if (mentionedUserId && String(mentionedUserId) === String(interfaceConfig.OwnerUserID))
				mentionsOwner = true
		}

	if (message.reply_to_message?.from?.id === Number(interfaceConfig.OwnerUserID)) {
		const isReplyToOwnerTopicCreation =
			message.message_thread_id !== undefined &&
			message.reply_to_message.message_id === message.message_thread_id &&
			chatType !== 'private'

		if (isReplyToOwnerTopicCreation)
			isReplyToOwnerTopicCreationMessage = true
		else
			mentionsOwner = true
	}

	return { mentionsOwner, isReplyToOwnerTopicCreationMessage }
}

/**
 * 从 Telegram 消息中为给定的 file ID 提取文件名和 MIME 类型。
 * @param {TelegramMessageType} message
 * @param {string} fileId
 * @param {string} fileNameFallback
 * @param {string} mimeTypeFallback
 * @returns {{fileName: string, mime_type: string}}
 */
function extractFileInfo(message, fileId, fileNameFallback, mimeTypeFallback) {
	let fileName = fileNameFallback
	let mime_type = mimeTypeFallback

	if (message.document && message.document.file_id === fileId) {
		fileName = message.document.file_name || fileNameFallback
		mime_type = message.document.mime_type || mimeTypeFallback
	}
	else if (message.audio && message.audio.file_id === fileId) {
		fileName = message.audio.file_name || fileNameFallback
		mime_type = message.audio.mime_type || mimeTypeFallback
	}
	else if (message.video && message.video.file_id === fileId) {
		fileName = message.video.file_name || fileNameFallback
		mime_type = message.video.mime_type || mimeTypeFallback
	}
	else if (message.photo && mimeTypeFallback === 'image/jpeg')
		mime_type = 'image/jpeg'
	else if (message.voice && message.voice.file_id === fileId)
		mime_type = message.voice.mime_type || 'audio/ogg'

	return { fileName, mime_type }
}

/**
 * 处理并下载附加到 Telegram 消息的文件。
 * @async
 * @param {TelegramMessageType} message
 * @param {TelegrafContext | undefined} ctx
 * @returns {Promise<Array<{name: string, buffer: Buffer, mime_type: string, description: string}>>}
 */
async function processMessageFiles(message, ctx) {
	const filesArr = []
	const fileDownloadPromises = []
	const telegrafAPI = ctx ? ctx.telegram : telegrafInstance?.telegram

	const addFile = async (fileId, fileNameFallback, mimeTypeFallback, description = '', extension) => {
		if (!telegrafAPI) {
			console.warn('[TelegramInterface:processMessageFiles] Cannot download file: Telegraf API accessor not available.')
			return
		}

		filesArr.push(async () => {
			try {
				const fileLink = await telegrafAPI.getFileLink(fileId)
				const response = await tryFewTimes(() => fetch(fileLink.href))
				if (!response.ok) throw new Error(`Failed to download file (ID: ${fileId}): ${response.statusText}`)
				const buffer = Buffer.from(await response.arrayBuffer())

				const { fileName, mime_type: extractedMimeType } = extractFileInfo(message, fileId, fileNameFallback, mimeTypeFallback)

				const finalMimeType = extractedMimeType || await mimetypeFromBufferAndName(buffer, fileName)
				return { name: fileName, buffer, mime_type: finalMimeType, description, extension }
			}
			catch (e) {
				console.error(`[TelegramInterface:processMessageFiles] Failed to process file (ID: ${fileId}):`, e)
			}
		})
	}

	try {
		if ('sticker' in message && message.sticker) {
			const { sticker } = message
			let fileIdToDownload = sticker.file_id
			let fileName
			let mimeType
			let description = `贴纸${sticker.emoji ? `: ${sticker.emoji}` : ''}`

			if (sticker.is_video) {
				fileName = `${sticker.file_unique_id}.webm`
				mimeType = 'video/webm'
			}
			else if (sticker.is_animated)
				if (sticker.thumb) {
					fileIdToDownload = sticker.thumb.file_id
					fileName = `animated_sticker_thumb_${sticker.file_unique_id}.jpg`
					mimeType = 'image/jpeg'
					description += ' (动画贴纸的缩略图)'
				}
				else {
					console.warn(`[TelegramInterface] Animated sticker ${sticker.file_unique_id} has no thumbnail, skipping.`)
					fileIdToDownload = null
				}
			else {
				fileName = `${sticker.file_unique_id}.webp`
				mimeType = 'image/webp'
			}

			if (fileIdToDownload)
				fileDownloadPromises.push(addFile(fileIdToDownload, fileName, mimeType, description, { is_from_vision: true }))
		}

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

		if (fileDownloadPromises.length)
			await Promise.all(fileDownloadPromises)
	} catch (error) {
		console.error(`[TelegramInterface:processMessageFiles] Top-level error occurred during file processing (MessageID ${message.message_id}):`, error)
	}
	return filesArr
}

/**
 * 将 Telegram 消息上下文转换为 Bot 逻辑层可以理解的 fount 聊天日志条目格式。
 * @async
 * @param {TelegrafContext | import('npm:telegraf').Telegraf} ctxOrBotInstance
 * @param {TelegramMessageType} message
 * @param {TelegramInterfaceConfig_t} interfaceConfig
 * @returns {Promise<chatLogEntry_t_ext | null>}
 */
export async function telegramMessageToFountChatLogEntry(ctxOrBotInstance, message, interfaceConfig) {
	if (!message || !message.from) return null

	const fromUser = message.from
	const { chat } = message
	const ctx = ctxOrBotInstance?.telegram ? ctxOrBotInstance : undefined

	const { senderName } = processUserInfo(fromUser)

	const rawText = message.text || message.caption
	const entities = message.entities || message.caption_entities

	const { mentionsOwner, isReplyToOwnerTopicCreationMessage } = detectMentions(message, rawText, entities, interfaceConfig, chat.type)

	if (isReplyToOwnerTopicCreationMessage)
		console.log(`[TelegramInterface] Identified a reply to owner's topic creation message. Message ID: ${message.message_id}, Replied To Message ID: ${message.reply_to_message.message_id}, Thread ID: ${message.message_thread_id}. This will NOT trigger 'mentions_owner' for AI context if not also an @mention.`)

	const replyToMessageForAiPrompt = isReplyToOwnerTopicCreationMessage ? undefined : message.reply_to_message
	let content = telegramEntitiesToAiMarkdown(rawText, entities, telegramBotInfo || undefined, replyToMessageForAiPrompt)
	if ('sticker' in message && message.sticker) {
		const sticker = message.sticker
		const description = `<:${sticker.file_id}:${sticker.set_name || 'unknown_set'}:${sticker.emoji || ''}>`
		content += `\n\n${description}`
		content = content.trim()
	}

	const files = await processMessageFiles(message, ctx)

	if (!content.trim() && !files.length)
		return null

	const isDirectMessage = chat.type === 'private'
	const isFromOwner = String(fromUser.id) === String(interfaceConfig.OwnerUserID)

	const mentionsBot = checkIfBotIsMentioned(rawText, message)

	/** @type {chatLogEntry_t_ext} */
	const fountEntry = {
		...aiReplyObjectCache[message.message_id],
		time_stamp: message.edit_date ? message.edit_date * 1000 : message.date * 1000,
		role: isFromOwner ? 'user' : 'char',
		name: senderName,
		content,
		files,
		extension: {
			platform: 'telegram',
			OwnerNameKeywords: interfaceConfig.OwnerNameKeywords,
			platform_message_ids: [message.message_id],
			content_parts: [content],
			platform_channel_id: chat.id,
			platform_user_id: fromUser.id,
			platform_chat_type: chat.type,
			platform_chat_title: chat.type !== 'private' ? chat.title : undefined,
			is_direct_message: isDirectMessage,
			is_from_owner: isFromOwner,
			mentions_bot: mentionsBot,
			mentions_owner: mentionsOwner,
			telegram_message_obj: message,
			...message.message_thread_id && { telegram_message_thread_id: message.message_thread_id },
			...message.reply_to_message && { telegram_reply_to_message_id: message.reply_to_message.message_id },
			...aiReplyObjectCache[message.message_id]?.extension,
		}
	}
	delete aiReplyObjectCache[message.message_id]
	return fountEntry
}
