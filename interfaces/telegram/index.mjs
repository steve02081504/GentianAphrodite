// 文件名: ./interfaces/telegram/index.mjs

/**
 * @file Telegram Interface Main File
 * @description Handles the connection, message processing, and API interactions
 * for the Telegram platform. It converts Telegram messages to a common
 * Fount format and sends Fount replies back to Telegram, supporting
 * rich text formatting via HTML. It also handles Telegram group topics/forums
 * by creating a logical channel ID for the bot core.
 */

import { Buffer } from 'node:buffer'

// 从 Bot 逻辑层导入核心处理函数和配置函数
import { processIncomingMessage, processMessageUpdate, cleanup as cleanupBotLogic } from '../../bot_core/index.mjs'
// 假设你的角色基础信息可以通过以下路径导入
import { charname as BotFountCharname } from '../../charbase.mjs'

// Telegram 接口特定的工具、插件和世界观
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
 *  OwnerUserID: string, // Telegram 用户的数字 ID (字符串形式)
 *  OwnerUserName: string, // 主人的 Telegram 用户名（用于日志或特定逻辑）
 *  OwnerNameKeywords: string[], // 主人名称的关键字列表，用于匹配
 * }} TelegramInterfaceConfig_t
 */

// --- 模块级变量 ---

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
 * 主要用于机器人自身的名称和 Fount 角色名的映射。
 * 键为显示名称 (string)，值为用户 ID (number)。
 * @type {Record<string, number>}
 */
const telegramDisplayNameToId = {}

/**
 * 缓存由 AI 生成并已发送的 FountChatReply_t 对象。
 * 键为第一条成功发送的 Telegram 消息的 ID (number)，值为原始的 {@link FountChatReply_t} 对象。
 * 用于在机器人自身消息被编辑或回复时，能够追溯到原始的 AI 输出。
 * @type {Record<number, FountChatReply_t>}
 */
const aiReplyObjectCacheTg = {}

// --- 辅助函数 ---

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
 * 从逻辑频道 ID 解析出平台的 chat.id 和可选的 threadId。
 * @param {string | number} logicalChannelId - Bot逻辑层使用的频道ID。
 * @returns {{chatId: string, threadId?: number}} 包含平台 chatId 和可选的 threadId 的对象。
 */
function parseLogicalChannelId(logicalChannelId) {
	const idStr = String(logicalChannelId)
	if (idStr.includes('_')) {
		const parts = idStr.split('_')
		// parts[0] 可能是负数 (群组ID)，所以直接用
		// parts[1] 是 threadId，应为正整数
		return { chatId: parts[0], threadId: parseInt(parts[1], 10) }
	}
	return { chatId: idStr } // 如果不含'_', 则认为是纯群组ID或私聊ID
}


/**
 * 获取此 Telegram 接口的配置模板。
 * @returns {TelegramInterfaceConfig_t} 配置模板对象。
 */
export function GetBotConfigTemplate() {
	return {
		OwnerUserID: 'YOUR_TELEGRAM_USER_ID', // 请替换为你的 Telegram 数字用户ID (字符串形式)
		OwnerUserName: 'YOUR_TELEGRAM_USERNAME', // 请替换为你的 Telegram 用户名
		OwnerNameKeywords: [
			'your_name_keyword1',
			'your_name_keyword2',
		],
	}
}

/**
 * 将 Telegram 消息上下文转换为 Bot 逻辑层可以理解的 Fount 聊天日志条目格式。
 * 此函数会处理文本格式 (Telegram Entities -> AI 方言 Markdown) 和文件。
 * @async
 * @param {TelegrafContext | TelegrafInstance} ctxOrBotInstance - Telegraf 的消息上下文或 Telegraf 实例 (当处理非实时消息时，如机器人自身发出的消息)。
 * @param {TelegramMessageType} message - 从上下文中提取的 Telegram 消息对象。
 * @param {TelegramInterfaceConfig_t} interfaceConfig - 当前 Telegram 接口的配置对象。
 * @returns {Promise<chatLogEntry_t_ext | null>} 转换后的 Fount 聊天日志条目，或在无法处理时返回 null。
 */
async function telegramMessageToFountChatLogEntry(ctxOrBotInstance, message, interfaceConfig) {
	if (!message || !message.from) return null // 无效消息或发送者

	const fromUser = message.from
	const { chat } = message
	// 检查 ctxOrBotInstance 是否是 Telegraf 上下文
	const ctx = 'telegram' in ctxOrBotInstance && typeof ctxOrBotInstance.telegram === 'object' ? ctxOrBotInstance : undefined


	// 尝试从缓存获取发送者信息，或直接使用消息中的 fromUser
	telegramUserCache[fromUser.id] = fromUser // 简单地更新缓存

	// 构建发送者名称
	let senderName = fromUser.first_name || ''
	if (fromUser.last_name) senderName += ` ${fromUser.last_name}`
	if (!senderName.trim() && fromUser.username) senderName = fromUser.username
	if (!senderName.trim()) senderName = `User_${fromUser.id}` // 最后备选
	// 避免重复添加 username，只有当 senderName 和 username 不同时才添加
	if (fromUser.username && !senderName.includes(`@${fromUser.username}`))
		senderName += ` (@${fromUser.username})`

	telegramUserIdToDisplayName[fromUser.id] = senderName

	// 特殊处理机器人自身发送的消息的名称
	if (telegramBotInfo && fromUser.id === telegramBotInfo.id) {
		let botDisplayName = telegramBotInfo.first_name || ''
		if (telegramBotInfo.last_name) botDisplayName += ` ${telegramBotInfo.last_name}`
		if (!botDisplayName.trim() && telegramBotInfo.username) botDisplayName = telegramBotInfo.username
		if (!botDisplayName.trim()) botDisplayName = BotFountCharname

		if (telegramBotInfo.username && !botDisplayName.includes(`@${telegramBotInfo.username}`))
			botDisplayName += ` (@${telegramBotInfo.username})`


		telegramDisplayNameToId[botDisplayName.split(' (')[0]] = fromUser.id // 映射不带 '(咱自己)' 的部分
		telegramDisplayNameToId[BotFountCharname] = fromUser.id // Fount 角色名也映射
		telegramUserIdToDisplayName[fromUser.id] = `${botDisplayName} (咱自己)`
		senderName = telegramUserIdToDisplayName[fromUser.id]
	}

	// 内容提取与转换 (Telegram Entities -> AI 方言 Markdown)
	const rawText = message.text || message.caption
	const entities = message.entities || message.caption_entities
	const content = telegramEntitiesToAiMarkdown(rawText, entities, telegramBotInfo || undefined, message.reply_to_message)

	// 文件处理
	const files = []
	try {
		const fileDownloadPromises = []
		const addFile = async (fileId, fileNameFallback, mimeTypeFallback, description = '') => {
			try {
				if (!ctx && !telegrafInstance) {
					console.warn('[TelegramInterface] Cannot download file: Telegraf context or instance not available.')
					return
				}
				const tgAPI = ctx ? ctx.telegram : telegrafInstance?.telegram
				if (!tgAPI) {
					console.warn('[TelegramInterface] Cannot download file: Telegram API accessor not available.')
					return
				}
				const fileLink = await tgAPI.getFileLink(fileId)
				const response = await tryFewTimes(() => fetch(fileLink.href))
				if (!response.ok) throw new Error(`下载文件 (ID: ${fileId}) 失败: ${response.statusText}`)
				const buffer = Buffer.from(await response.arrayBuffer())

				let fileName = fileNameFallback
				let mimeType = mimeTypeFallback
				if ('document' in message && message.document && message.document.file_id === fileId) {
					fileName = message.document.file_name || fileNameFallback
					mimeType = message.document.mime_type || mimeTypeFallback
				} else if ('photo' in message && message.photo)
					mimeType = 'image/jpeg'
				else if ('audio' in message && message.audio && message.audio.file_id === fileId) {
					fileName = message.audio.file_name || fileNameFallback
					mimeType = message.audio.mime_type || mimeTypeFallback
				} else if ('video' in message && message.video && message.video.file_id === fileId) {
					fileName = message.video.file_name || fileNameFallback
					mimeType = message.video.mime_type || mimeTypeFallback
				} else if ('voice' in message && message.voice && message.voice.file_id === fileId)
					mimeType = message.voice.mime_type || 'audio/ogg'


				const finalMimeType = mimeType || await mimetypeFromBufferAndName(buffer, fileName)
				files.push({ name: fileName, buffer, mimeType: finalMimeType, description })
			} catch (e) { console.error(`[TelegramInterface] 处理文件 (ID: ${fileId}) 失败:`, e) }
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

		if (fileDownloadPromises.length > 0)
			await Promise.all(fileDownloadPromises)

	} catch (error) {
		console.error(`[TelegramInterface] 文件处理时发生顶层错误 (消息ID ${message.message_id}):`, error)
	}

	if (!content.trim() && files.length === 0)
		return null


	const isDirectMessage = chat.type === 'private'
	const isFromOwner = String(fromUser.id) === String(interfaceConfig.OwnerUserID)

	let mentionsBot = false
	if (telegramBotInfo) {
		if (telegramBotInfo.username && rawText && rawText.toLowerCase().includes(`@${telegramBotInfo.username.toLowerCase()}`))
			mentionsBot = true
		else if (BotFountCharname && rawText && rawText.toLowerCase().includes(BotFountCharname.toLowerCase())) // 检查Fount角色名
			mentionsBot = true

		if (message.reply_to_message?.from?.id === telegramBotInfo.id)
			mentionsBot = true
	}

	let mentionsOwner = false
	if (message.entities && rawText)
		for (const entity of message.entities)
			if (entity.type === 'mention' || entity.type === 'text_mention') {
				let mentionedUserId
				if (entity.type === 'text_mention' && entity.user?.id)
					mentionedUserId = entity.user.id
				else if (entity.type === 'mention') {
					const mentionText = rawText.substring(entity.offset, entity.offset + entity.length)
					if (mentionText === `@${interfaceConfig.OwnerUserName}`)
						mentionedUserId = interfaceConfig.OwnerUserID // 通过配置的用户名匹配

				}
				if (String(mentionedUserId) === String(interfaceConfig.OwnerUserID)) {
					mentionsOwner = true
					break
				}
			}


	// 如果是回复给主人的消息，也算提及主人
	if (message.reply_to_message?.from?.id === Number(interfaceConfig.OwnerUserID))
		mentionsOwner = true

	/** @type {chatLogEntry_t_ext} */
	const fountEntry = {
		timeStamp: message.edit_date ? message.edit_date * 1000 : message.date * 1000,
		role: isFromOwner ? 'user' : 'char',
		name: senderName,
		content,
		files,
		extension: {
			platform: 'telegram',
			OwnerNameKeywords: interfaceConfig.OwnerNameKeywords,
			platform_message_ids: [message.message_id],
			platform_channel_id: chat.id, // 存储原始的 chat.id
			platform_user_id: fromUser.id,
			platform_chat_type: chat.type,
			platform_chat_title: chat.type !== 'private' ? chat.title : undefined,
			is_direct_message: isDirectMessage,
			is_from_owner: isFromOwner,
			mentions_bot: mentionsBot,
			mentions_owner: mentionsOwner,
			telegram_message_obj: message, // 可选: 传递原始 Telegram Message 对象
			...message.message_thread_id && { telegram_message_thread_id: message.message_thread_id }, // 存储分区ID
			...message.reply_to_message && { telegram_reply_to_message_id: message.reply_to_message.message_id },
			...aiReplyObjectCacheTg[message.message_id]?.extension,
		}
	}
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


	/** @type {PlatformAPI_t} */
	const telegramPlatformAPI = {
		name: 'telegram',
		config: interfaceConfig,

		async sendMessage(logicalChannelId, fountReplyPayload, originalMessageEntry) {
			const { chatId, threadId: threadIdFromLogicalId } = parseLogicalChannelId(logicalChannelId) // 解析逻辑ID
			const platformChatId = chatId // 用于 Telegram API 调用的 chatId

			const aiMarkdownContent = fountReplyPayload.content || ''
			const files = fountReplyPayload.files || []
			const parseMode = 'HTML'

			const replyToMessageId = originalMessageEntry?.extension?.platform_message_ids?.[0]
			// 优先使用 originalMessageEntry 中的 thread_id，因为它来自触发消息的上下文。
			// 如果没有，则使用从 logicalChannelId 解析出来的 threadId (例如机器人主动发送消息到某个 topic)。
			const messageThreadId = originalMessageEntry?.extension?.telegram_message_thread_id || threadIdFromLogicalId

			const htmlContent = aiMarkdownToTelegramHtml(aiMarkdownContent)

			let firstSentTelegramMessage = null
			const baseOptions = {
				parse_mode: parseMode,
				...replyToMessageId && { reply_to_message_id: replyToMessageId },
				...messageThreadId && { message_thread_id: messageThreadId }
			}

			const sendFileWithCaption = async (file, captionAiMarkdown, isLastFile) => {
				let sentMsg
				const fileSource = { source: file.buffer, filename: file.name }
				let finalCaptionHtml = captionAiMarkdown ? aiMarkdownToTelegramHtml(captionAiMarkdown) : undefined

				const CAPTION_LENGTH_LIMIT = 1024
				if (finalCaptionHtml && finalCaptionHtml.length > CAPTION_LENGTH_LIMIT) {
					console.warn(`[TelegramInterface] 文件 "${file.name}" 的HTML标题过长 (${finalCaptionHtml.length} > ${CAPTION_LENGTH_LIMIT})，将尝试截断。`)
					const originalCaptionText = captionAiMarkdown || ''
					let truncatedCaptionAiMarkdown = ''
					if (originalCaptionText.length > CAPTION_LENGTH_LIMIT * 0.8)
						truncatedCaptionAiMarkdown = originalCaptionText.substring(0, Math.floor(CAPTION_LENGTH_LIMIT * 0.7)) + '...'
					else
						truncatedCaptionAiMarkdown = originalCaptionText

					finalCaptionHtml = aiMarkdownToTelegramHtml(truncatedCaptionAiMarkdown)
					if (finalCaptionHtml.length > CAPTION_LENGTH_LIMIT) {
						const plainTextCaption = (captionAiMarkdown || file.description || '').substring(0, CAPTION_LENGTH_LIMIT - 10) + '...'
						finalCaptionHtml = escapeHTML(plainTextCaption)
						console.warn(`[TelegramInterface] 截断后HTML标题仍过长，使用纯文本回退: ${plainTextCaption.substring(0, 50)}...`)
					}
				}

				const sendOptions = { ...baseOptions, caption: finalCaptionHtml }

				try {
					if (file.mimeType?.startsWith('image/'))
						sentMsg = await tryFewTimes(() => bot.telegram.sendPhoto(platformChatId, fileSource, sendOptions))
					else if (file.mimeType?.startsWith('audio/'))
						sentMsg = await tryFewTimes(() => bot.telegram.sendAudio(platformChatId, fileSource, { ...sendOptions, title: file.name }))
					else if (file.mimeType?.startsWith('video/'))
						sentMsg = await tryFewTimes(() => bot.telegram.sendVideo(platformChatId, fileSource, sendOptions))
					else
						sentMsg = await tryFewTimes(() => bot.telegram.sendDocument(platformChatId, fileSource, sendOptions))

				} catch (e) {
					console.error(`[TelegramInterface] 发送文件 ${file.name} (ChatID: ${platformChatId}, ThreadID: ${messageThreadId}) 失败:`, e)
					const fallbackText = `[文件发送失败: ${file.name}] ${file.description || captionAiMarkdown || ''}`.trim()
					if (fallbackText)
						try {
							sentMsg = await tryFewTimes(() => bot.telegram.sendMessage(platformChatId, escapeHTML(fallbackText.substring(0, 4000)), baseOptions))
						} catch (e2) { console.error('[TelegramInterface] 发送文件失败的回退消息也失败:', e2) }

				}
				return sentMsg
			}

			if (files.length > 0) {
				let mainTextSentAsCaption = false
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
							if (sentMsg && !firstSentTelegramMessage) firstSentTelegramMessage = sentMsg
						} catch (e) { console.error(`[TelegramInterface] 发送剩余HTML文本 (ChatID: ${platformChatId}, ThreadID: ${messageThreadId}) 失败:`, e) }

				}
			} else if (htmlContent.trim()) {
				const textParts = splitTelegramReply(htmlContent, 4096)
				for (const part of textParts)
					try {
						const sentMsg = await tryFewTimes(() => bot.telegram.sendMessage(platformChatId, part, baseOptions))
						if (sentMsg && !firstSentTelegramMessage) firstSentTelegramMessage = sentMsg
					} catch (e) { console.error(`[TelegramInterface] 发送HTML文本消息 (ChatID: ${platformChatId}, ThreadID: ${messageThreadId}) 失败:`, e) }

			}

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
			console.warn(`[TelegramInterface] fetchChannelHistory 未在 Telegram 接入层完全实现 (LogicalID: ${logicalChannelId}, PlatformChatID: ${chatId}, ThreadID: ${threadId})。依赖内存日志。`)
			return []
		},

		getBotUserId: () => telegramBotInfo ? telegramBotInfo.id : -1,
		getBotUsername: () => telegramBotInfo ? telegramBotInfo.username || BotFountCharname : 'UnknownBot',
		getBotDisplayName: () => telegramBotInfo ? telegramUserIdToDisplayName[telegramBotInfo.id] || telegramBotInfo.first_name || telegramBotInfo.username || BotFountCharname : 'Unknown Bot',

		getOwnerUserName: () => interfaceConfig.OwnerUserName,
		getOwnerUserId: () => interfaceConfig.OwnerUserID,

		getChatNameForAI: (logicalChannelId, triggerMessage) => {
			const { chatId: platformChatId, threadId: threadIdFromLogical } = parseLogicalChannelId(logicalChannelId)

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
				// 优先使用触发消息中的 thread_id，因为它更精确反映当前上下文
				const actualThreadId = triggerMessage?.extension?.telegram_message_thread_id || threadIdFromLogical
				if (actualThreadId)
					baseName += `: Thread ${actualThreadId}`

				return baseName
			}
			return `Telegram: Chat ${logicalChannelId}` // 使用完整的逻辑 ID 作为备选
		},

		destroySelf: async () => {
			console.log('[TelegramInterface] 正在关闭 Telegram 接口...')
			await cleanupBotLogic()
			if (telegrafInstance) {
				telegrafInstance.stop('SIGINT')
				console.log('[TelegramInterface] Telegraf 实例已停止。')
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

		splitReplyText: (text) => splitTelegramReply(text, 3800), // 3800 is a conservative estimate for HTML
	}

	// --- Telegraf 事件监听 ---
	bot.on('message', async (ctx) => {
		if ('message' in ctx.update) {
			const { message } = ctx.update
			const fountEntry = await telegramMessageToFountChatLogEntry(ctx, message, interfaceConfig)
			if (fountEntry) {
				// 使用 message 中的 chat.id 和 message_thread_id (如果存在) 来构造逻辑频道 ID
				const logicalChanId = constructLogicalChannelId(message.chat.id, message.message_thread_id)
				await processIncomingMessage(fountEntry, telegramPlatformAPI, logicalChanId)
			}
		}
	})

	bot.on('edited_message', async (ctx) => {
		if ('edited_message' in ctx.update) {
			const message = ctx.update.edited_message
			const fountEntry = await telegramMessageToFountChatLogEntry(ctx, message, interfaceConfig)
			if (fountEntry) {
				const logicalChanId = constructLogicalChannelId(message.chat.id, message.message_thread_id)
				await processMessageUpdate(fountEntry, telegramPlatformAPI, logicalChanId)
			}
		}
	})
}
