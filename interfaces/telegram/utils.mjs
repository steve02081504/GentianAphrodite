import { escapeHTML } from '../../scripts/tools.mjs'

/**
 * @file Telegram Interface Utilities
 * @description Provides utility functions for the Telegram interface,
 * including Markdown/HTML escaping, message splitting, and conversion
 * between Telegram message entities and an AI-friendly Markdown dialect.
 */

/** @typedef {import('./state.mjs').TelegramBotInfo} TelegramBotInfo */
/** @typedef {import('npm:telegraf/typings/core/types/typegram').Message} TelegramMessageType */
/** @typedef {import('npm:telegraf/typings/core/types/typegram').MessageEntity} TelegramMessageEntity */

/**
 * 转义 Telegram MarkdownV2 特殊字符。
 * @param {string} text - 需要转义的文本。
 * @returns {string} 转义后的文本。
 */
export function escapeMarkdownV2(text) {
	if (!text) return ''
	return text.replace(/([!#()*+.=>?[\\]_`{|}~-])/g, '\\$1')
}

/**
 * 将 Telegram 消息文本和实体转换为 AI 方言 Markdown。
 * @param {string | undefined} text
 * @param {TelegramMessageEntity[] | undefined} entities
 * @param {TelegramBotInfo | undefined} botInfo
 * @param {TelegramMessageType | undefined} replyToMessage
 * @returns {string}
 */
export function telegramEntitiesToAiMarkdown(text, entities, botInfo, replyToMessage) {
	let aiMarkdown = ''

	if (replyToMessage) {
		const repliedFrom = replyToMessage.from
		let replierName = '未知用户'
		if (repliedFrom)
			if (botInfo && repliedFrom.id === botInfo.id)
				replierName = botInfo.first_name || botInfo.username || '我'
			else
				replierName = repliedFrom.first_name || repliedFrom.username || `User_${repliedFrom.id}`

		const repliedTextContent = replyToMessage.text || replyToMessage.caption || ''
		const repliedEntities = replyToMessage.entities || replyToMessage.caption_entities

		let repliedPreview = ''
		if (repliedTextContent) {
			const maxLength = 80
			const isTruncated = repliedTextContent.length > maxLength
			const previewText = repliedTextContent.substring(0, maxLength) + (isTruncated ? '...' : '')
			repliedPreview = telegramEntitiesToAiMarkdown(previewText, repliedEntities, undefined, undefined)
		} else if (replyToMessage.photo)
			repliedPreview = '[图片]'
		else if (replyToMessage.video)
			repliedPreview = '[视频]'
		else if (replyToMessage.voice)
			repliedPreview = '[语音]'
		else if (replyToMessage.document)
			repliedPreview = `[文件: ${replyToMessage.document.file_name || '未知'}]`

		if (repliedPreview) {
			aiMarkdown += repliedPreview.split('\n').map(line => `> ${line}`).join('\n')
			aiMarkdown += `\n(回复 ${replierName})\n\n`
		}
	}

	if (!text) return aiMarkdown.trim()

	const textChars = Array.from(text)
	if (!entities || entities.length === 0)
		return aiMarkdown + text

	const parts = []
	let lastOffset = 0

	const sortedEntities = [...entities].sort((a, b) => a.offset - b.offset)

	for (const entity of sortedEntities) {
		if (entity.offset > lastOffset)
			parts.push(textChars.slice(lastOffset, entity.offset).join(''))

		const entityText = textChars.slice(entity.offset, entity.offset + entity.length).join('')
		let formattedEntityText = entityText

		switch (entity.type) {
			case 'bold':
				formattedEntityText = `**${entityText}**`
				break
			case 'italic':
				formattedEntityText = `*${entityText}*`
				break
			case 'underline':
				formattedEntityText = `__${entityText}__`
				break
			case 'strikethrough':
				formattedEntityText = `~~${entityText}~~`
				break
			case 'spoiler':
				formattedEntityText = `||${entityText}||`
				break
			case 'code':
				formattedEntityText = `\`${entityText}\``
				break
			case 'pre':
				formattedEntityText = '```' + (entity.language ? entity.language : '') + '\n' + entityText + '\n```'
				break
			case 'text_link':
				formattedEntityText = `[${entityText}](${entity.url})`
				break
			case 'blockquote':
				formattedEntityText = entityText.split('\n').map(line => `> ${line}`).join('\n')
				break
			case 'text_mention':
				formattedEntityText = `@[${entityText} (UserID:${entity.user.id})]`
				break
			case 'mention':
			case 'hashtag':
			case 'cashtag':
			case 'bot_command':
			case 'url':
			case 'email':
			case 'phone_number':
				formattedEntityText = entityText
				break
			default:
				formattedEntityText = entityText
		}
		parts.push(formattedEntityText)
		lastOffset = entity.offset + entity.length
	}

	if (lastOffset < textChars.length)
		parts.push(textChars.slice(lastOffset).join(''))

	aiMarkdown += parts.join('')

	return aiMarkdown.trim()
}

/**
 * 将 AI 方言 Markdown 转换为 Telegram HTML 格式。
 * @param {string} aiMarkdownText
 * @returns {string}
 */
export function aiMarkdownToTelegramHtml(aiMarkdownText) {
	if (!aiMarkdownText) return ''

	let html = escapeHTML(aiMarkdownText)

	html = html.replace(/```(\w*)\n([\S\s]*?)\n```/g, (match, lang, code) => {
		const langClass = lang ? ` class=\"language-${escapeHTML(lang)}\"` : ''
		return `<pre><code${langClass}>${code}</code></pre>`
	})

	html = html.replace(/(?<!\\)`([^\n`]+?)(?<!\\)`/g, (match, code) => `<code>${code}</code>`)

	html = html.replace(/\[(.*?)]\\((.*?)\\)/g, (match, text, url) => {
		return `<a href=\"${url}\">${text}</a>`
	})

	html = html.replace(/\\|\\|(.+?)\\|\\|/g, (match, content) => `<tg-spoiler>${content}</tg-spoiler>`)

	html = html.replace(/\\*\\*(.+?)\\*\\*/g, '<b>$1</b>')
	html = html.replace(/(?<!\\*)\\*([^*]+?)\\*(?!\\*)/g, '<i>$1</i>')
	html = html.replace(/__(.+?)__/g, '<u>$1</u>')
	html = html.replace(/~~(.+?)~~/g, '<s>$1</s>')

	const lines = html.split('\n')
	let inBlockquote = false
	const processedLines = []
	const blockquoteStartTag = '&gt; '

	for (const line of lines)
		if (line.startsWith(blockquoteStartTag)) {
			const quoteContent = line.substring(blockquoteStartTag.length)
			if (!inBlockquote) {
				processedLines.push('<blockquote>')
				inBlockquote = true
			}
			processedLines.push(quoteContent)
		} else {
			if (inBlockquote) {
				processedLines.push('</blockquote>')
				inBlockquote = false
			}
			processedLines.push(line)
		}

	if (inBlockquote)
		processedLines.push('</blockquote>')

	html = processedLines.join('\n')

	return html
}

/**
 * 分割 Telegram 回复文本以适应其消息长度限制。
 * @param {string} reply
 * @param {number} [split_length=4096]
 * @returns {string[]}
 */
export function splitTelegramReply(reply, split_length = 4096) {
	if (!reply) return []

	const messages = []
	let currentMessage = ''
	const lines = reply.split('\n')

	for (const line of lines)
		if (currentMessage.length + (currentMessage ? 1 : 0) + line.length <= split_length) {
			if (currentMessage) currentMessage += '\n'
			currentMessage += line
		} else {
			if (currentMessage) messages.push(currentMessage)
			currentMessage = line

			if (currentMessage.length > split_length) {
				const parts = splitHtmlAware(currentMessage, split_length)
				if (parts.length > 1) {
					messages.push(...parts.slice(0, -1))
					currentMessage = parts[parts.length - 1]
				} else if (parts.length === 1)
					currentMessage = parts[0]
			}
		}

	if (currentMessage)
		if (currentMessage.length > split_length)
			messages.push(...splitHtmlAware(currentMessage, split_length))
		else
			messages.push(currentMessage)

	return messages.filter(msg => msg.trim().length > 0)
}

/**
 * @param {string} longString
 * @param {number} maxLength
 * @returns {string[]}
 */
function splitHtmlAware(longString, maxLength) {
	const chunks = []
	let remainingString = longString

	while (remainingString.length > maxLength) {
		const candidateChunk = remainingString.substring(0, maxLength)
		const lastTagCloseIndex = candidateChunk.lastIndexOf('>')
		const lastNewlineIndex = candidateChunk.lastIndexOf('\n')
		const lastSpaceIndex = candidateChunk.lastIndexOf(' ')

		let splitPos = Math.max(
			lastTagCloseIndex > -1 ? lastTagCloseIndex + 1 : -1,
			lastNewlineIndex > -1 ? lastNewlineIndex + 1 : -1,
			lastSpaceIndex > -1 ? lastSpaceIndex + 1 : -1
		)

		if (splitPos <= 1)
			splitPos = maxLength

		chunks.push(remainingString.substring(0, splitPos))
		remainingString = remainingString.substring(splitPos)
	}

	if (remainingString.length > 0)
		chunks.push(remainingString)

	return chunks
}

/**
 * 构造供 Bot 逻辑层使用的逻辑频道 ID。
 * @param {string | number} chatId
 * @param {number | undefined} threadId
 * @returns {string}
 */
export function constructLogicalChannelId(chatId, threadId) {
	if (threadId !== undefined && threadId !== null)
		return `${chatId}_${threadId}`
	return String(chatId)
}

/**
 * 从逻辑频道 ID 解析出平台的 chat.id 和可选的 threadId。
 * @param {string | number} logicalChannelId
 * @returns {{chatId: string, threadId?: number}}
 */
export function parseLogicalChannelId(logicalChannelId) {
	const idStr = String(logicalChannelId)
	if (idStr.includes('_')) {
		const parts = idStr.split('_')
		return { chatId: parts[0], threadId: parseInt(parts[1], 10) }
	}
	return { chatId: idStr }
}
