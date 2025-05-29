// 文件名: ./interfaces/telegram/index.mjs

/**
 * @file Telegram 接口主文件
 * @description 处理 Telegram 平台的连接、消息处理和 API 交互。
 * 它将 Telegram 消息转换为通用的 Fount 格式，并将 Fount 回复发送回 Telegram，
 * 支持通过 HTML 进行富文本格式化。它还通过为 Bot 核心创建一个逻辑频道 ID 来处理
 * Telegram 群组的分区/话题。
 */

import { Buffer } from 'node:buffer'

// 从 Bot 逻辑层导入核心处理函数和配置函数
import { processIncomingMessage, processMessageUpdate, cleanup as cleanupBotLogic, registerPlatformAPI } from '../../bot_core/index.mjs'
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

	let mentionsOwner = false
	let isReplyToOwnerTopicCreationMessage = false

	// 1. 检查显式提及 (@username 或 text_mention)
	const rawText = message.text || message.caption
	const entities = message.entities || message.caption_entities

	if (entities && rawText)
		for (const entity of entities)
			if (entity.type === 'mention' || entity.type === 'text_mention') {
				let mentionedUserId
				if (entity.type === 'text_mention' && entity.user?.id)
					mentionedUserId = entity.user.id
				else if (entity.type === 'mention') {
					const mentionText = rawText.substring(entity.offset, entity.offset + entity.length)
					// 使用配置的 OwnerUserName 进行匹配
					if (mentionText === `@${interfaceConfig.OwnerUserName}`)
						// 如果配置了 OwnerUserID，则使用它进行更准确的匹配
						mentionedUserId = interfaceConfig.OwnerUserID ? Number(interfaceConfig.OwnerUserID) : undefined
				}
				if (String(mentionedUserId) === String(interfaceConfig.OwnerUserID)) {
					mentionsOwner = true
					// 如果已明确提及主人，则无需再检查回复，因为这是更强的意图
					break
				}
			}



	// 2. 检查回复主人的消息，但排除回复话题创建消息的情况
	if (message.reply_to_message?.from?.id === Number(interfaceConfig.OwnerUserID))
		// 判断是否是回复主人创建的话题的第一个消息 (即话题本身)
		// message.message_thread_id 是话题的第一个消息的 message_id。
		// 如果当前消息确实属于一个话题 (message.message_thread_id 存在)
		// 并且被回复的消息的 message_id 等于当前消息所在的话题的 message_thread_id，
		// 则认为它是对话题创建消息的回复。
		if (message.message_thread_id !== undefined &&
			message.reply_to_message.message_id === message.message_thread_id) {
			isReplyToOwnerTopicCreationMessage = true
			// 此时不设置 mentionsOwner = true，因为我们认为这不是对主人的直接“提及”意图
			console.log(`[TelegramInterface] Identified a reply to owner's topic creation message. Message ID: ${message.message_id}, Replied To Message ID: ${message.reply_to_message.message_id}, Thread ID: ${message.message_thread_id}. This will NOT trigger 'mentions_owner' for AI context.`)
		} else
			// 如果不是回复话题创建消息，而是回复主人在话题内或话题外发送的其他消息，则视为提及主人
			mentionsOwner = true



	// 内容提取与转换 (Telegram Entities -> AI 方言 Markdown)
	// 关键修改：如果当前消息是回复主人创建的话题的第一个消息，则不将 message.reply_to_message 传递给 AI Markdown 转换器
	const replyToMessageForAiPrompt = isReplyToOwnerTopicCreationMessage ? undefined : message.reply_to_message
	const content = telegramEntitiesToAiMarkdown(rawText, entities, telegramBotInfo || undefined, replyToMessageForAiPrompt)

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
				if (!response.ok) throw new Error(`Failed to download file (ID: ${fileId}): ${response.statusText}`)
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
			} catch (e) { console.error(`[TelegramInterface] Failed to process file (ID: ${fileId}):`, e) }
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
		console.error(`[TelegramInterface] Top-level error occurred during file processing (MessageID ${message.message_id}):`, error)
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
		console.log(`[TelegramInterface] Telegram bot connected: @${telegramBotInfo.username}`)
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
					console.warn(`[TelegramInterface] HTML caption for file "${file.name}" is too long (${finalCaptionHtml.length} > ${CAPTION_LENGTH_LIMIT}), will try to truncate.`)
					const originalCaptionText = captionAiMarkdown || ''
					let truncatedCaptionAiMarkdown = ''
					// 尝试保留 markdown 格式进行截断
					if (originalCaptionText.length > CAPTION_LENGTH_LIMIT * 0.8)
						truncatedCaptionAiMarkdown = originalCaptionText.substring(0, Math.floor(CAPTION_LENGTH_LIMIT * 0.7)) + '...'
					else
						truncatedCaptionAiMarkdown = originalCaptionText


					finalCaptionHtml = aiMarkdownToTelegramHtml(truncatedCaptionAiMarkdown)
					if (finalCaptionHtml.length > CAPTION_LENGTH_LIMIT) {
						// 如果 HTML 仍然过长，回退到纯文本截断
						const plainTextCaption = (captionAiMarkdown || file.description || '').substring(0, CAPTION_LENGTH_LIMIT - 10) + '...'
						finalCaptionHtml = escapeHTML(plainTextCaption) // 确保纯文本也进行 HTML 转义
						console.warn('[TelegramInterface] HTML caption still too long after markdown truncation, falling back to plain text:', plainTextCaption.substring(0, 50) + '...')
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
					console.error(`[TelegramInterface] Failed to send file ${file.name} (ChatID: ${platformChatId}, ThreadID: ${messageThreadId}):`, e)
					// 文件发送失败时，发送文本回退消息
					const fallbackText = `[文件发送失败: ${file.name}] ${file.description || captionAiMarkdown || ''}`.trim()
					if (fallbackText)
						try {
							// 确保 fallback text 也进行 HTML 转义，因为 parse_mode 是 HTML
							sentMsg = await tryFewTimes(() => bot.telegram.sendMessage(platformChatId, escapeHTML(fallbackText.substring(0, 4000)), baseOptions))
						} catch (e2) { console.error('[TelegramInterface] Fallback message for failed file send also failed:', e2) }

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
						// 如果只有一个文件，且文件本身没有描述，则将主文本作为其标题
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
						} catch (e) { console.error(`[TelegramInterface] Failed to send remaining HTML text (ChatID: ${platformChatId}, ThreadID: ${messageThreadId}):`, e) }

				}
			} else if (htmlContent.trim()) {
				const textParts = splitTelegramReply(htmlContent, 4096)
				for (const part of textParts)
					try {
						const sentMsg = await tryFewTimes(() => bot.telegram.sendMessage(platformChatId, part, baseOptions))
						if (sentMsg && !firstSentTelegramMessage) firstSentTelegramMessage = sentMsg
					} catch (e) { console.error(`[TelegramInterface] Failed to send HTML text message (ChatID: ${platformChatId}, ThreadID: ${messageThreadId}):`, e) }

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
			console.warn(`[TelegramInterface] fetchChannelHistory not fully implemented in Telegram interface (LogicalID: ${logicalChannelId}, PlatformChatID: ${chatId}, ThreadID: ${threadId}). Relying on in-memory logs.`)
			// Telegram Bot API 不直接提供拉取完整群组历史消息的功能
			// 因此这里返回空数组是预期行为
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
			console.log('[TelegramInterface] Shutting down Telegram interface...')
			await cleanupBotLogic()
			if (telegrafInstance) {
				telegrafInstance.stop('SIGINT')
				console.log('[TelegramInterface] Telegraf instance stopped.')
			}
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
					type: chat.type, // Telegram chat type (e.g., 'group', 'supergroup', 'private')
					telegramChat: chat // Store original chat object
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

		splitReplyText: (text) => splitTelegramReply(text, 3800), // 3800 是 HTML 的保守估计，以适应 Telegram 的 4096 字符限制

		/**
		 * (可选) 设置当机器人加入新群组/服务器时调用的回调函数。
		 * @param {(group: import('../../bot_core/index.mjs').GroupObject) => Promise<void>} onJoinCallback - 回调函数。
		 */
		onGroupJoin: (onJoinCallback) => {
			if (telegrafInstance && typeof onJoinCallback === 'function')
				// 监听 my_chat_member 更新，当机器人状态从 'left'/'kicked'/'restricted' 变为 'member'/'administrator' 时，表示加入群组
				telegrafInstance.on('my_chat_member', async (ctx) => {
					const oldStatus = ctx.myChatMember.old_chat_member.status
					const newStatus = ctx.myChatMember.new_chat_member.status
					const { chat } = ctx.myChatMember

					// 检查 Bot 是否被添加到群组或超级群组
					if ((oldStatus === 'left' || oldStatus === 'kicked' || oldStatus === 'restricted') &&
						(newStatus === 'member' || newStatus === 'administrator') &&
						(chat.type === 'group' || chat.type === 'supergroup')) {
						console.log(`[TelegramInterface] Joined new group: ${chat.title} (ID: ${chat.id})`)
						/** @type {import('../../bot_core/index.mjs').GroupObject} */
						const groupObject = {
							id: chat.id,
							name: chat.title || `Group ${chat.id}`,
							telegramChat: chat // 存储原始聊天对象
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
			// Telegram Bot API 不支持直接获取所有已加入的群组列表
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
				// Telegram API 只能获取管理员列表，无法获取所有成员
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
				// Telegram ExportChatInviteLink doesn't directly support threadId for link creation
				// The link is for the chat itself, users can then choose a topic.
				const link = await telegrafInstance.telegram.exportChatInviteLink(String(chatId))
				console.log(`[TelegramInterface] Generated invite link for chat ${chatId}.`)
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
				console.log(`[TelegramInterface] Left group: ${chatId}`)
			} catch (error) {
				console.error(`[TelegramInterface] Error leaving group ${chatId}:`, error)
			}
		},

		/**
		 * (可选) 获取群组/服务器的默认或合适的首选频道。
		 * @param {string | number} chatId - 群组的 ID。
		 * @returns {Promise<import('../../bot_core/index.mjs').ChannelObject | null>}
		 */
		getGroupDefaultChannel: async (chatId) => {
			// 该方法已在上方定义，此处重复，保持一致
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
					type: chat.type, // Telegram chat type
					telegramChat: chat
				}
				return channelObject
			} catch (error) {
				console.error(`[TelegramInterface] Error getting chat info for ${chatId}:`, error)
				return null
			}
		},

		/**
		 * (可选) 优化方法：一次性获取主人在哪些群组中、不在哪些群组中。
		 * @returns {Promise<{groupsWithOwner: import('../../bot_core/index.mjs').GroupObject[], groupsWithoutOwner: import('../../bot_core/index.mjs').GroupObject[]} | null>}
		 */
		getOwnerPresenceInGroups: async () => {
			console.warn('[TelegramInterface] getOwnerPresenceInGroups is not supported by the Telegram Bot API due to privacy restrictions and API limitations. This method will return null, and the system should fall back to other methods for startup checks if applicable.')
			// Telegram Bot API 不支持直接获取所有 Bot 所在群组中特定用户的存在情况
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

			// 监听 chat_member 更新，判断用户状态变化
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
				const chatTitle = chatMemberUpdate.chat.title || `Chat ${chatId}`
				const userUsername = chatMemberUpdate.new_chat_member.user.username || `User ${userId}`

				// 检查用户是否真正离开或被踢出 (之前是成员或管理员)
				if ((oldStatus === 'member' || oldStatus === 'administrator' || oldStatus === 'creator') &&
					(newStatus === 'left' || newStatus === 'kicked')) {
					console.log(`[TelegramInterface] Member status changed: User ${userUsername} (ID: ${userId}) is now '${newStatus}' in chat ${chatTitle} (ID: ${chatId}). Old status: '${oldStatus}'.`)
					try {
						// 确保 ID 比较的类型一致性
						await onLeaveCallback(String(chatId), String(userId))
					} catch (e) {
						console.error(`[TelegramInterface] Error in onOwnerLeaveGroup callback for user ${userId} in chat ${chatId}:`, e)
					}
				}
			})
			console.log('[TelegramInterface] chat_member event listener set up for onOwnerLeaveGroup.')
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
				// 确保 OwnerUserID 是数字类型，因为 Telegram API 需要
				const ownerIdNumber = Number(interfaceConfig.OwnerUserID)
				if (isNaN(ownerIdNumber)) {
					console.error('[TelegramInterface] sendDirectMessageToOwner: OwnerUserID is not a valid number.')
					return
				}
				// Telegram sendMessage supports HTML parse_mode
				await telegrafInstance.telegram.sendMessage(ownerIdNumber, messageText, { parse_mode: 'HTML' })
				console.log(`[TelegramInterface] Sent DM to owner (ID: ${ownerIdNumber})`)
			} catch (error) {
				console.error(`[TelegramInterface] Error sending DM to owner (ID: ${interfaceConfig.OwnerUserID}):`, error)
			}
		}
	}

	// --- Telegraf 事件监听 ---
	telegrafInstance.on('message', async (ctx) => {
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

	// 将平台 API 注册到 Bot 核心
	await registerPlatformAPI(telegramPlatformAPI)
	return telegramPlatformAPI // 返回平台 API 对象
}
