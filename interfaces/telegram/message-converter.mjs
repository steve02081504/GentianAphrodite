import { Buffer } from 'node:buffer'

import { charname as BotFountCharname } from '../../charbase.mjs'
import { mimetypeFromBufferAndName } from '../../scripts/mimetype.mjs'
import { tryFewTimes } from '../../scripts/tryFewTimes.mjs'

import { telegrafInstance, telegramBotInfo, telegramUserCache, telegramUserIdToDisplayName, telegramDisplayNameToId, aiReplyObjectCache } from './state.mjs'
import { telegramEntitiesToAiMarkdown } from './utils.mjs'

/**
 * Telegram 接口配置类型定义
 * @typedef {import('./config.mjs').TelegramInterfaceConfig_t} TelegramInterfaceConfig_t
 * 聊天日志条目类型定义
 * @typedef {import('../../bot_core/index.mjs').chatLogEntry_t_ext} chatLogEntry_t_ext
 */
/** @typedef {import('npm:telegraf').Context} TelegrafContext */
/** @typedef {import('npm:telegraf/typings/core/types/typegram').Message} TelegramMessageType */
/** @typedef {import('npm:telegraf/typings/core/types/typegram').User} TelegramUser */

/**
 * 检查机器人是否在消息中被提及。
 * @param {string | undefined} rawText - 原始文本内容。
 * @param {TelegramMessageType} message - Telegram 消息对象。
 * @returns {boolean} - 如果机器人被提及，则返回 true；否则返回 false。
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
 * @returns {string} - 机器人的显示名称。
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
 * @param {TelegramUser} fromUser - Telegram 用户对象。
 * @returns {{senderName: string}} - 包含发送者名称的对象。
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
 * @param {import('npm:telegraf/typings/core/types/typegram').MessageEntity} entity - 消息实体对象。
 * @param {string} rawText - 原始文本。
 * @param {TelegramInterfaceConfig_t} interfaceConfig - Telegram 接口配置对象。
 * @returns {number | string | undefined} - 被提及用户的 ID，如果未找到则为 undefined。
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
 * @param {TelegramMessageType} message - Telegram 消息对象。
 * @param {string | undefined} rawText - 原始文本内容。
 * @param {Array<import('npm:telegraf/typings/core/types/typegram').MessageEntity> | undefined} entities - 消息实体数组。
 * @param {TelegramInterfaceConfig_t} interfaceConfig - Telegram 接口配置对象。
 * @param {string} chatType - 聊天类型。
 * @returns {{mentionsOwner: boolean, isReplyToOwnerTopicCreationMessage: boolean}} - 提及信息对象。
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
			message.message_thread_id &&
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
 * @param {TelegramMessageType} message - Telegram 消息对象。
 * @param {string} fileId - 文件 ID。
 * @param {string} fileNameFallback - 文件名回退值。
 * @param {string} mimeTypeFallback - MIME 类型回退值。
 * @returns {{fileName: string, mime_type: string}} - 包含文件名和 MIME 类型。
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
 * 将贴纸对象转换为 AI 可识别的文本标记，格式为 `<:fileId:setName:emoji>`。
 * 此标记可被平台层解析为对应的贴纸 file_id，从而在回复时发送实物贴纸。
 * @param {import('npm:telegraf/typings/core/types/typegram').Sticker} sticker - Telegram 贴纸对象。
 * @returns {string} - 贴纸文本标记。
 */
function buildStickerTextDescription(sticker) {
	return `<:${sticker.file_id}:${sticker.set_name || 'unknown_set'}:${sticker.emoji || ''}:>`
}

/**
 * 将 Telegram 消息的文本内容（含实体格式化、回复引用、贴纸描述）统一构建为 AI Markdown 字符串。
 * - 使用 `telegramEntitiesToAiMarkdown` 将实体标注转换为 AI 方言 Markdown；
 * - 若消息是回复，则在内容前插入引用块（由 `telegramEntitiesToAiMarkdown` 处理）；
 * - 若消息包含贴纸，则在文本末尾追加贴纸的文本描述标记。
 * @param {TelegramMessageType} message - 原始 Telegram 消息对象。
 * @param {string | undefined} rawText - 消息的原始文本（text 或 caption）。
 * @param {import('npm:telegraf/typings/core/types/typegram').MessageEntity[] | undefined} entities - 消息实体数组。
 * @param {TelegramMessageType | undefined} replyToMessage - 被回复的消息（已过滤主题创建消息），传入 undefined 则不添加引用。
 * @returns {string} - 构建完成的 AI Markdown 文本内容。
 */
function buildEntryTextContent(message, rawText, entities, replyToMessage) {
	const entityMarkdown = telegramEntitiesToAiMarkdown(rawText, entities, telegramBotInfo || undefined, replyToMessage)
	if (!message.sticker)
		return entityMarkdown
	const stickerDesc = buildStickerTextDescription(message.sticker)
	return [entityMarkdown, stickerDesc].filter(Boolean).join('\n\n')
}

/**
 * 处理并下载附加到 Telegram 消息的文件。
 * 返回值是一个**惰性异步函数数组**（`Array<() => Promise<FileObject>>`），而非已解析的文件对象。
 * 这是为了支持 `bot_core/utils.mjs` 中 `fetchFiles()` 的按需并发拉取模式：
 * 文件只会在真正需要时（如判断复读触发后）才被下载，避免对不需要处理的消息浪费带宽。
 * @async
 * @param {TelegramMessageType} message - Telegram 消息对象。
 * @param {TelegrafContext | undefined} ctx - Telegraf 上下文对象。
 * @returns {Promise<Array<() => Promise<{name: string, buffer: Buffer, mime_type: string, description: string} | undefined>>>} - 惰性文件下载函数数组。
 */
async function processMessageFiles(message, ctx) {
	const filesArr = []
	const fileDownloadPromises = []
	const telegrafAPI = ctx ? ctx.telegram : telegrafInstance?.telegram

	/**
	 * 添加文件到下载队列。
	 * @param {string} fileId - 文件 ID。
	 * @param {string} fileNameFallback - 文件名回退值。
	 * @param {string} mimeTypeFallback - MIME 类型回退值。
	 * @param {string} [description=''] - 文件描述。
	 * @param {object} extension - 扩展信息。
	 * @returns {Promise<void>}
	 */
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
		if (message.sticker) {
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
				if (sticker.thumbnail) {
					fileIdToDownload = sticker.thumbnail.file_id
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
 * 相册合并：抽取各分片的正文片段与提及状态；同一条合并日志内仅注入一次「回复引用」块，避免重复。
 * @param {TelegramMessageType[]} sorted - 已按 `message_id` 排好序的媒体组消息。
 * @param {TelegramInterfaceConfig_t} interfaceConfig - Telegram 接口配置（主人 ID、关键词等）。
 * @param {TelegrafContext | undefined} ctx - Telegraf 上下文；与单条转换 API 对齐，当前构建正文未使用。
 * @returns {{ contentParts: string[], content: string, mentionsOwner: boolean, mentionsBot: boolean, hadReplyToOwnerTopicCreationMessage: boolean }} 各分片正文、拼接全文及提及相关标志。
 */
function extractContentPartsAndMentions(sorted, interfaceConfig, ctx) {
	void ctx
	const { chat } = sorted[0]
	const contentParts = []
	let mentionsOwner = false
	let mentionsBot = false
	let hadReplyToOwnerTopicCreationMessage = false
	let replyQuotedInjected = false

	for (const message of sorted) {
		const rawText = message.text || message.caption
		const entities = message.entities || message.caption_entities
		const { mentionsOwner: mo, isReplyToOwnerTopicCreationMessage } = detectMentions(message, rawText, entities, interfaceConfig, chat.type)

		if (mo) mentionsOwner = true
		let replyToMessageForAiPrompt
		if (isReplyToOwnerTopicCreationMessage) hadReplyToOwnerTopicCreationMessage = true
		else if (message.reply_to_message && !replyQuotedInjected) {
			replyToMessageForAiPrompt = message.reply_to_message
			replyQuotedInjected = true
		}

		contentParts.push(buildEntryTextContent(message, rawText, entities, replyToMessageForAiPrompt))
		if (checkIfBotIsMentioned(rawText, message)) mentionsBot = true
	}

	return {
		contentParts,
		content: contentParts.join('\n'),
		mentionsOwner,
		mentionsBot,
		hadReplyToOwnerTopicCreationMessage,
	}
}

/**
 * 对相册内每条消息分别调用 `processMessageFiles`，再扁平化为单一 `files` 数组。
 * @param {TelegramMessageType[]} sorted - 已排序的媒体组消息。
 * @param {TelegrafContext | undefined} ctx - 用于拉取文件的 Telegraf API 上下文。
 * @returns {Promise<Array>} 各消息 `processMessageFiles` 结果的扁平数组（惰性下载函数，与单条消息的 `files` 字段一致）。
 */
async function aggregateFilesFromMessages(sorted, ctx) {
	const filesNested = await Promise.all(sorted.map(m => processMessageFiles(m, ctx)))
	return filesNested.flat()
}

/**
 * 合并相册内各 `message_id` 在 `aiReplyObjectCache` 中的条目并清空缓存键。
 * @param {TelegramMessageType[]} sorted - 已排序的媒体组消息。
 * @returns {{ mergedAiReply: Record<string, unknown>, mergedAiReplyExtension: Record<string, unknown> }} 供展开到 `fountEntry` 与其 `extension` 的缓存片段。
 */
function mergeAiReplyCacheForMessages(sorted) {
	let mergedAiReply = {}
	let mergedAiReplyExtension = {}
	for (const message of sorted) {
		const mid = message.message_id
		const cached = aiReplyObjectCache[mid]
		if (!cached) continue
		mergedAiReply = { ...mergedAiReply, ...cached }
		if (cached.extension)
			mergedAiReplyExtension = { ...mergedAiReplyExtension, ...cached.extension }
		delete aiReplyObjectCache[mid]
	}
	return { mergedAiReply, mergedAiReplyExtension }
}

/**
 * 组装相册合并后的单条 `chatLogEntry_t_ext`（含 `extension.platform_message_ids` 等）。
 * @param {{
 * 	sorted: TelegramMessageType[];
 * 	primary: TelegramMessageType;
 * 	interfaceConfig: TelegramInterfaceConfig_t;
 * 	senderName: string;
 * 	content: string;
 * 	contentParts: string[];
 * 	mentionsOwner: boolean;
 * 	mentionsBot: boolean;
 * 	files: unknown[];
 * 	mergedAiReply: Record<string, unknown>;
 * 	mergedAiReplyExtension: Record<string, unknown>;
 * }} params - 已由主流程算好的排序、正文、文件与缓存合并结果。
 * @returns {chatLogEntry_t_ext} 可直接入队交给 `bot_core` 的聊天日志条目。
 */
function buildFountEntry(params) {
	const {
		sorted, primary, interfaceConfig, senderName, content, contentParts,
		mentionsOwner, mentionsBot, files, mergedAiReply, mergedAiReplyExtension,
	} = params
	const fromUser = primary.from
	const { chat } = primary
	const messageWithReply = sorted.find(m => m.reply_to_message)
	const isDirectMessage = chat.type === 'private'
	const isFromOwner = String(fromUser.id) === String(interfaceConfig.OwnerUserID)

	return {
		content,
		...mergedAiReply,
		time_stamp: Math.max(...sorted.map(m => (m.edit_date ?? m.date) * 1000)),
		role: isFromOwner ? 'user' : 'char',
		name: senderName,
		files,
		extension: {
			platform: 'telegram',
			OwnerNameKeywords: interfaceConfig.OwnerNameKeywords,
			platform_message_ids: sorted.map(m => m.message_id),
			content_parts: contentParts,
			platform_channel_id: chat.id,
			platform_user_id: fromUser.id,
			platform_chat_type: chat.type,
			platform_chat_title: chat.type !== 'private' ? chat.title : undefined,
			is_direct_message: isDirectMessage,
			is_from_owner: isFromOwner,
			mentions_bot: mentionsBot,
			mentions_owner: mentionsOwner,
			telegram_message_obj: primary,
			telegram_media_group_id: primary.media_group_id,
			...primary.message_thread_id && { telegram_message_thread_id: primary.message_thread_id },
			...messageWithReply?.reply_to_message && { telegram_reply_to_message_id: messageWithReply.reply_to_message.message_id },
			...mergedAiReplyExtension,
		},
	}
}

/**
 * 将同一相册（`media_group_id` 相同）的多条 Telegram 消息合并为一条 `chatLogEntry_t_ext`。
 * `platform_message_ids` 与 `content_parts` 按 `message_id` 排序对齐，便于 `processMessageUpdate` 逐条编辑。
 * @param {TelegrafContext | import('npm:telegraf').Telegraf} ctxOrBotInstance - Telegraf 的上下文对象或 bot 实例。
 * @param {TelegramMessageType[]} messages - 属于同一媒体组的消息数组（调用方已去重）。
 * @param {TelegramInterfaceConfig_t} interfaceConfig - 此 Telegram 接口的配置对象。
 * @returns {Promise<chatLogEntry_t_ext | null>} 合并成功则返回一条日志条目；无有效内容时返回 `null`。
 */
export async function telegramMediaGroupMessagesToFountChatLogEntry(ctxOrBotInstance, messages, interfaceConfig) {
	if (!messages?.length) return null

	const sorted = [...messages].sort((a, b) => a.message_id - b.message_id)
	const primary = sorted[0]
	if (!primary.from) return null

	for (const m of sorted)
		if (m.from?.id !== primary.from.id || m.chat.id !== primary.chat.id)
			console.warn('[TelegramInterface] Media group member chat/from mismatch, still merging.', {
				media_group_id: primary.media_group_id,
				expected_from: primary.from.id,
				got_from: m.from?.id,
			})

	const ctx = ctxOrBotInstance?.telegram ? ctxOrBotInstance : undefined
	const { senderName } = processUserInfo(primary.from)

	const { contentParts, content, mentionsOwner, mentionsBot } = extractContentPartsAndMentions(sorted, interfaceConfig, ctx)
	const files = await aggregateFilesFromMessages(sorted, ctx)
	const { mergedAiReply, mergedAiReplyExtension } = mergeAiReplyCacheForMessages(sorted)

	if (!content.trim() && !files.length)
		return null

	return buildFountEntry({
		sorted,
		primary,
		interfaceConfig,
		senderName,
		content,
		contentParts,
		mentionsOwner,
		mentionsBot,
		files,
		mergedAiReply,
		mergedAiReplyExtension,
	})
}

/**
 * 将 Telegram 消息上下文转换为 Bot 核心逻辑可以理解的 Fount 聊天日志条目格式。
 * 这个函数处理文本、贴纸、文件、提及以及其他 Telegram 特有的消息属性，
 * 将它们统一成一个标准的 `chatLogEntry_t_ext` 对象。
 * @param {TelegrafContext | import('npm:telegraf').Telegraf} ctxOrBotInstance - Telegraf 的上下文对象或 bot 实例，用于 API 调用。
 * @param {TelegramMessageType} message - 从 Telegram 收到的原始消息对象。
 * @param {TelegramInterfaceConfig_t} interfaceConfig - 此 Telegram 接口的配置对象。
 * @returns {Promise<chatLogEntry_t_ext | null>} - 转换后的 Fount 聊天日志条目。如果消息无效或不应处理，则返回 `null`。
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
	const content = buildEntryTextContent(message, rawText, entities, replyToMessageForAiPrompt)

	const files = await processMessageFiles(message, ctx)

	if (!content.trim() && !files.length)
		return null

	const isDirectMessage = chat.type === 'private'
	const isFromOwner = String(fromUser.id) === String(interfaceConfig.OwnerUserID)

	const mentionsBot = checkIfBotIsMentioned(rawText, message)

	/** @type {chatLogEntry_t_ext} */
	const fountEntry = {
		content,
		...aiReplyObjectCache[message.message_id],
		time_stamp: message.edit_date ? message.edit_date * 1000 : message.date * 1000,
		role: isFromOwner ? 'user' : 'char',
		name: senderName,
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
