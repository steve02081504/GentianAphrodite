import { cleanup as cleanupBotLogic } from '../../bot_core/index.mjs'
import { charname as BotFountCharname } from '../../charbase.mjs'
import { escapeHTML } from '../../scripts/tools.mjs'
import { tryFewTimes } from '../../scripts/tryFewTimes.mjs'

import { get_telegram_api_plugin } from './api.mjs'
import { telegramMessageToFountChatLogEntry } from './message-converter.mjs'
import { telegrafInstance, telegramBotInfo, telegramUserIdToDisplayName, aiReplyObjectCache } from './state.mjs'
import { splitTelegramReply, aiMarkdownToTelegramHtml, parseLogicalChannelId } from './utils.mjs'
import { telegramWorld } from './world.mjs'

/**
 * @typedef {import('./config.mjs').TelegramInterfaceConfig_t} TelegramInterfaceConfig_t
 */
/**
 * @typedef {import('../../bot_core/index.mjs').PlatformAPI_t} PlatformAPI_t
 */
/**
 * @typedef {import('../../bot_core/index.mjs').chatLogEntry_t_ext} chatLogEntry_t_ext
 */
/**
 * @typedef {import('../../../../../../../src/public/shells/chat/decl/chatLog.ts').FountChatReply_t} FountChatReply_t
 */
/** @typedef {import('npm:telegraf/typings/core/types/typegram').Message} TelegramMessageType */

const CAPTION_LENGTH_LIMIT = 1024 // Telegram 的说明文字长度限制

/**
 * 如果说明文字过长，则尝试多种策略进行截断。
 * @param {string | undefined} captionAiMarkdown
 * @param {string} fileNameForDebug
 * @returns {string | undefined}
 */
function truncateCaption(captionAiMarkdown, fileNameForDebug) {
	if (!captionAiMarkdown) return undefined

	let finalCaptionHtml = aiMarkdownToTelegramHtml(captionAiMarkdown)

	if (finalCaptionHtml && finalCaptionHtml.length > CAPTION_LENGTH_LIMIT) {
		console.warn(`[TelegramInterface] HTML caption for file "${fileNameForDebug}" is too long (${finalCaptionHtml.length} > ${CAPTION_LENGTH_LIMIT}), will try to truncate.`)
		let truncatedCaptionAiMarkdown = ''
		if (captionAiMarkdown.length > CAPTION_LENGTH_LIMIT * 0.8)
			truncatedCaptionAiMarkdown = captionAiMarkdown.substring(0, Math.floor(CAPTION_LENGTH_LIMIT * 0.7)) + '...'
		else
			truncatedCaptionAiMarkdown = captionAiMarkdown

		finalCaptionHtml = aiMarkdownToTelegramHtml(truncatedCaptionAiMarkdown)

		if (finalCaptionHtml.length > CAPTION_LENGTH_LIMIT) {
			const plainTextCaption = captionAiMarkdown.substring(0, CAPTION_LENGTH_LIMIT - 10) + '...'
			finalCaptionHtml = escapeHTML(plainTextCaption)
			console.warn(`[TelegramInterface] HTML caption for "${fileNameForDebug}" still too long after markdown truncation, falling back to plain text:`, plainTextCaption.substring(0, 50) + '...')
		}
	}
	return finalCaptionHtml
}

/**
 * 尝试根据 MIME 类型使用各种 Telegram 方法发送文件。
 * @param {import('npm:telegraf').Telegraf} bot
 * @param {string | number} platformChatId
 * @param {{source: Buffer, filename: string}} fileSource
 * @param {object} sendOptions
 * @param {{name: string, mime_type?: string, description?: string}} file
 * @param {string | undefined} captionAiMarkdown
 * @param {object} baseOptions
 * @param {number | undefined} messageThreadId
 * @returns {Promise<TelegramMessageType | undefined>}
 */
async function trySendFileOrFallbackText(
	bot, platformChatId, fileSource, sendOptions,
	file, captionAiMarkdown, baseOptions, messageThreadId
) {
	let sentMsg
	try {
		if (file.mime_type?.startsWith('image/'))
			sentMsg = await tryFewTimes(() => bot.telegram.sendPhoto(platformChatId, fileSource, sendOptions))
		else if (file.mime_type?.startsWith('audio/'))
			sentMsg = await tryFewTimes(() => bot.telegram.sendAudio(platformChatId, fileSource, { ...sendOptions, title: file.name }))
		else if (file.mime_type?.startsWith('video/'))
			sentMsg = await tryFewTimes(() => bot.telegram.sendVideo(platformChatId, fileSource, sendOptions))
		else
			sentMsg = await tryFewTimes(() => bot.telegram.sendDocument(platformChatId, fileSource, sendOptions))
	}
	catch (e) {
		console.error(`[TelegramInterface] Failed to send file ${file.name} (ChatID: ${platformChatId}, ThreadID: ${messageThreadId}):`, e)
		const fallbackText = `[文件发送失败: ${file.name}] ${file.description || captionAiMarkdown || ''}`.trim()
		if (fallbackText) try {
			sentMsg = await tryFewTimes(() => bot.telegram.sendMessage(platformChatId, escapeHTML(fallbackText.substring(0, 4000)), baseOptions))
		} catch (e2) {
			console.error('[TelegramInterface] Fallback message for failed file send also failed:', e2)
		}
	}
	return sentMsg
}

/**
 * 为回复消息准备参数，调整内容和选项。
 * @param {chatLogEntry_t_ext | undefined} originalMessageEntry
 * @param {string} aiMarkdownContent
 * @param {object} baseOptions
 * @returns {{aiMarkdownContent: string, baseOptions: object}}
 */
function prepareReplyParameters(originalMessageEntry, aiMarkdownContent, baseOptions) {
	let updatedAiMarkdownContent = aiMarkdownContent
	const updatedBaseOptions = { ...baseOptions }

	if (originalMessageEntry?.extension?.platform_message_ids?.slice?.(-1)?.[0]) {
		const replyToMessageId = originalMessageEntry.extension.platform_message_ids.slice(-1)[0]
		const fromUser = originalMessageEntry.extension.telegram_message_obj.from
		const mentionPatterns = [
			`@${fromUser.first_name} (@${fromUser.username})`,
			`@${fromUser.first_name}`,
			`@${fromUser.username}`,
		]

		for (const mention of mentionPatterns)
			if (updatedAiMarkdownContent.startsWith(mention)) {
				updatedBaseOptions.reply_to_message_id = replyToMessageId
				updatedAiMarkdownContent = updatedAiMarkdownContent.slice(mention.length).trimStart()
				break
			}
	}
	return { aiMarkdownContent: updatedAiMarkdownContent, baseOptions: updatedBaseOptions }
}

/**
 * @param {import('npm:telegraf').Telegraf} bot
 * @param {string | number} platformChatId
 * @param {number | undefined} messageThreadId
 * @param {object} baseOptions
 * @param {any[]} files
 * @param {string} aiMarkdownContent
 * @param {string} htmlContent
 * @returns {Promise<TelegramMessageType | null>}
 */
async function sendFiles(bot, platformChatId, messageThreadId, baseOptions, files, aiMarkdownContent, htmlContent) {
	let firstSentTelegramMessage = null
	let mainTextSentAsCaption = false

	const sendFileWithCaption = async (file, captionAiMarkdown, isLastFile) => {
		const fileSource = { source: file.buffer, filename: file.name }
		const finalCaptionHtml = truncateCaption(captionAiMarkdown, file.name)
		const sendOptions = { ...baseOptions, caption: finalCaptionHtml }

		return await trySendFileOrFallbackText(
			bot, platformChatId, fileSource, sendOptions,
			file, captionAiMarkdown, baseOptions, messageThreadId
		)
	}

	for (let i = 0; i < files.length; i++) {
		const file = files[i]
		const isLastFile = i === files.length - 1
		let captionForThisFileAiMarkdown = file.description

		if (isLastFile && aiMarkdownContent.trim()) {
			captionForThisFileAiMarkdown = aiMarkdownContent
			mainTextSentAsCaption = true
		}
		else if (!captionForThisFileAiMarkdown && aiMarkdownContent.trim() && files.length === 1) {
			captionForThisFileAiMarkdown = aiMarkdownContent
			mainTextSentAsCaption = true
		}
		const sentMsg = await sendFileWithCaption(file, captionForThisFileAiMarkdown, isLastFile)
		if (sentMsg && !firstSentTelegramMessage)
			firstSentTelegramMessage = sentMsg
	}

	const stickerRegex = /&lt;:([^:]+):[^:]*:[^>]*&gt;\s*/g
	const stickerIDarray = []
	let match
	while ((match = stickerRegex.exec(htmlContent)) !== null) {
		stickerIDarray.push(match[1])
		htmlContent = htmlContent.replace(match[0], '')
	}
	if (!mainTextSentAsCaption && htmlContent.trim()) {
		const remainingHtmlParts = splitTelegramReply(htmlContent, 4096)
		for (const part of remainingHtmlParts) try {
			const sentMsg = await tryFewTimes(() => bot.telegram.sendMessage(platformChatId, part, baseOptions))
			if (sentMsg && !firstSentTelegramMessage)
				firstSentTelegramMessage = sentMsg
		} catch (e) {
			console.error(`[TelegramInterface] Failed to send remaining HTML text (ChatID: ${platformChatId}, ThreadID: ${messageThreadId}):`, e)
		}
	}
	for (const stickerID of stickerIDarray) try {
		const sentMsg = await tryFewTimes(() => bot.telegram.sendSticker(platformChatId, stickerID, baseOptions))
		if (sentMsg && !firstSentTelegramMessage)
			firstSentTelegramMessage = sentMsg
	} catch (e) {
		console.error(`[TelegramInterface] Failed to send sticker message (ChatID: ${platformChatId}, ThreadID: ${baseOptions.message_thread_id}):`, e)
	}

	return firstSentTelegramMessage
}

/**
 * @param {import('npm:telegraf').Telegraf} bot
 * @param {string | number} platformChatId
 * @param {object} baseOptions
 * @param {string} htmlContent
 * @returns {Promise<TelegramMessageType | null>}
 */
async function sendTextMessages(bot, platformChatId, baseOptions, htmlContent) {
	const stickerRegex = /&lt;:([^:]+):[^:]*:[^>]*&gt;\s*/g
	const stickerIDarray = []
	let match
	while ((match = stickerRegex.exec(htmlContent)) !== null) {
		stickerIDarray.push(match[1])
		htmlContent = htmlContent.replace(match[0], '')
	}
	let firstSentTelegramMessage = null
	if (htmlContent.trim()) {
		const textParts = splitTelegramReply(htmlContent, 4096)
		for (const part of textParts) try {
			const sentMsg = await tryFewTimes(() => bot.telegram.sendMessage(platformChatId, part, baseOptions))
			if (sentMsg && !firstSentTelegramMessage)
				firstSentTelegramMessage = sentMsg
		} catch (e) {
			console.error(`[TelegramInterface] Failed to send HTML text message (ChatID: ${platformChatId}, ThreadID: ${baseOptions.message_thread_id}):`, e)
		}
	}
	for (const stickerID of stickerIDarray) try {
		const sentMsg = await tryFewTimes(() => bot.telegram.sendSticker(platformChatId, stickerID, baseOptions))
		if (sentMsg && !firstSentTelegramMessage)
			firstSentTelegramMessage = sentMsg
	} catch (e) {
		console.error(`[TelegramInterface] Failed to send sticker message (ChatID: ${platformChatId}, ThreadID: ${baseOptions.message_thread_id}):`, e)
	}

	return firstSentTelegramMessage
}

/**
 * @param {import('npm:telegraf').Telegraf} bot
 * @param {string | number} platformChatId
 * @param {number | undefined} messageThreadId
 * @param {object} baseOptions
 * @param {any[]} files
 * @param {string} aiMarkdownContent
 * @param {string} htmlContent
 * @returns {Promise<TelegramMessageType | null>}
 */
async function dispatchMessageSender(
	bot, platformChatId, messageThreadId, baseOptions,
	files, aiMarkdownContent, htmlContent
) {
	if (files.length)
		return await sendFiles(bot, platformChatId, messageThreadId, baseOptions, files, aiMarkdownContent, htmlContent)
	else if (htmlContent.trim())
		return await sendTextMessages(bot, platformChatId, baseOptions, htmlContent)

	return null
}

/**
 * 构建并返回一个实现了 PlatformAPI_t 接口的对象，用于 Telegram 平台。
 * 该对象封装了所有与 Telegram API 交互的底层细节，
 * 为机器人核心逻辑提供了一套标准化的函数，如 sendMessage、sendTyping 等。
 * @param {TelegramInterfaceConfig_t} interfaceConfig - 此 Telegram 接口的配置对象。
 * @returns {PlatformAPI_t} - 实现了 PlatformAPI_t 接口的对象实例。
 */
export function buildPlatformAPI(interfaceConfig) {
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

			const messageThreadId = originalMessageEntry?.extension?.telegram_message_thread_id || threadIdFromLogicalId

			const htmlContent = aiMarkdownToTelegramHtml(aiMarkdownContent)

			let firstSentTelegramMessage = null
			const initialBaseOptions = {
				parse_mode: parseMode,
				...messageThreadId && { message_thread_id: messageThreadId }
			}

			const { aiMarkdownContent: finalAiMarkdownContent, baseOptions: finalBaseOptions } = prepareReplyParameters(originalMessageEntry, aiMarkdownContent, initialBaseOptions)
			aiMarkdownContent = finalAiMarkdownContent

			firstSentTelegramMessage = await dispatchMessageSender(
				telegrafInstance, platformChatId, messageThreadId, finalBaseOptions,
				files, aiMarkdownContent, htmlContent
			)

			if (firstSentTelegramMessage) {
				if (fountReplyPayload && (fountReplyPayload.content || fountReplyPayload.files?.length))
					aiReplyObjectCache[firstSentTelegramMessage.message_id] = fountReplyPayload

				return await telegramMessageToFountChatLogEntry(telegrafInstance, firstSentTelegramMessage, interfaceConfig)
			}
			return null
		},

		async sendTyping(logicalChannelId, originalMessageEntry) {
			const { chatId, threadId: threadIdFromLogicalId } = parseLogicalChannelId(logicalChannelId)
			const platformChatId = chatId
			try {
				const messageThreadId = originalMessageEntry?.extension?.telegram_message_thread_id || threadIdFromLogicalId
				await telegrafInstance.telegram.sendChatAction(platformChatId, 'typing', {
					...messageThreadId && { message_thread_id: messageThreadId }
				})
			} catch (e) { /* 静默处理 */ }
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
			}
			else if (chatTitle) {
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

		getGroupDefaultChannel: async chatId => {
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
			}
			catch (error) {
				console.error(`[TelegramInterface] Error getting chat info for ${chatId}:`, error)
				return null
			}
		},

		logError: (error, contextMessage) => {
			console.error('[TelegramInterface-PlatformAPI-Error]', error, contextMessage ? `Context: ${JSON.stringify(contextMessage)}` : '')
		},

		getPlatformSpecificPlugins: messageEntry => {
			if (messageEntry?.extension?.telegram_message_obj)
				return {
					telegram_api: get_telegram_api_plugin(messageEntry.extension.telegram_message_obj),
				}

			return {}
		},

		getPlatformWorld: () => telegramWorld,

		onGroupJoin: onJoinCallback => {
			if (telegrafInstance)
				telegrafInstance.on('my_chat_member', async ctx => {
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
						}
						catch (e) {
							console.error(`[TelegramInterface] Error in onGroupJoin callback for chat ${chat.id}:`, e)
						}
					}
				})
			else
				console.error('[TelegramInterface] Could not set onGroupJoin: bot instance or callback invalid.')
		},

		getJoinedGroups: async () => {
			console.warn('[TelegramInterface] getJoinedGroups is not reliably supported by Telegram Bot API. It may return an empty list or only previously known chats.')
			return Promise.resolve([])
		},

		getGroupMembers: async chatId => {
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
			}
			catch (error) {
				console.error(`[TelegramInterface] Error fetching group administrators for chat ${chatId}:`, error)
				return []
			}
		},

		generateInviteLink: async (chatId, threadId) => {
			if (!telegrafInstance) {
				console.error('[TelegramInterface] generateInviteLink: Telegraf instance not available.')
				return null
			}
			try {
				const link = await telegrafInstance.telegram.exportChatInviteLink(String(chatId))
				return link
			}
			catch (e) {
				console.error(`[TelegramInterface] Failed to generate invite link for ${chatId}:`, e)
				return null
			}
		},

		leaveGroup: async chatId => {
			if (!telegrafInstance) {
				console.error('[TelegramInterface] leaveGroup: Telegraf instance not available.')
				return
			}
			try {
				await telegrafInstance.telegram.leaveChat(String(chatId))
			}
			catch (error) {
				console.error(`[TelegramInterface] Error leaving group ${chatId}:`, error)
			}
		},

		getOwnerPresenceInGroups: async () => {
			console.warn('[TelegramInterface] getOwnerPresenceInGroups is not supported by the Telegram Bot API due to privacy restrictions and API limitations. This method will return null, and the system should fall back to other methods for startup checks if applicable.')
			return null
		},

		onOwnerLeaveGroup: onLeaveCallback => {
			if (!telegrafInstance) {
				console.error('[TelegramInterface] onOwnerLeaveGroup: Telegraf instance not initialized.')
				return
			}

			telegrafInstance.on('chat_member', async ctx => {
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
					}
					catch (e) {
						console.error(`[TelegramInterface] Error in onOwnerLeaveGroup callback for user ${userId} in chat ${chatId}:`, e)
					}
			})
		},

		sendDirectMessageToOwner: async messageText => {
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
			}
			catch (error) {
				console.error(`[TelegramInterface] Error sending DM to owner (ID: ${interfaceConfig.OwnerUserID}):`, error)
			}
		}
	}
	return telegramPlatformAPI
}
