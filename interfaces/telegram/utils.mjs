import { escapeHTML } from '../../scripts/tools.mjs'

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
 * @param {string | undefined} text - 原始文本内容。
 * @param {TelegramMessageEntity[] | undefined} entities - 消息实体数组。
 * @param {TelegramBotInfo | undefined} botInfo - 机器人信息对象。
 * @param {TelegramMessageType | undefined} replyToMessage - 回复的消息对象。
 * @returns {string} - 转换后的 AI Markdown 格式文本。
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
		}
		else if (replyToMessage.photo)
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
	if (!entities?.length)
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
 * @param {string} aiMarkdownText - AI Markdown 格式的文本。
 * @returns {string} - 转换后的 Telegram HTML 格式文本。
 */
export function aiMarkdownToTelegramHtml(aiMarkdownText) {
	if (!aiMarkdownText) return ''

	// 首先，转义原始文本中的HTML特殊字符，防止注入
	let html = escapeHTML(aiMarkdownText)

	// 代码块: ```lang\ncode\n``` -> <pre><code class="language-lang">code</code></pre>
	html = html.replace(/```(\w*)\n([\S\s]*?)\n```/g, (match, lang, code) => {
		const langClass = lang ? ` class="language-${escapeHTML(lang)}"` : ''
		// 在pre/code标签内的内容不需要再次转义，因为它已经是被escapeHTML处理过的
		return `<pre><code${langClass}>${code}</code></pre>`
	})

	// 行内代码: `code` -> <code>code</code>
	html = html.replace(/(?<!\\)`([^\n`]+?)(?<!\\)`/g, (match, code) => `<code>${code}</code>`)

	// 链接: [text](url) -> <a href="url">text</a>
	html = html.replace(/\[(.*?)]\((.*?)\)/g, (match, text, url) => {
		return `<a href="${escapeHTML(url)}">${text}</a>`
	})

	// 剧透: ||content|| -> <tg-spoiler>content</tg-spoiler>
	html = html.replace(/\|\|(.+?)\|\|/g, (match, content) => `<tg-spoiler>${content}</tg-spoiler>`)

	// 加粗: **content** -> <b>content</b>
	html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')

	// 斜体: *content* -> <i>content</i> (不匹配被**包裹的)
	html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<i>$1</i>')

	// 下划线: __content__ -> <u>content</u>
	html = html.replace(/__(.+?)__/g, '<u>$1</u>')

	// 删除线: ~~content~~ -> <s>content</s>
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
		}
		else {
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
 * @param {string} reply - 原始回复文本。
 * @param {number} [split_length=4096] - 每个消息段的最大长度。
 * @returns {string[]} - 分割后的消息段数组。
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
		}
		else {
			if (currentMessage) messages.push(currentMessage)
			currentMessage = line

			if (currentMessage.length > split_length) {
				const parts = splitHtmlAware(currentMessage, split_length)
				if (parts.length > 1) {
					messages.push(...parts.slice(0, -1))
					currentMessage = parts[parts.length - 1]
				}
				else if (parts.length === 1) currentMessage = parts[0]
			}
		}

	if (currentMessage)
		if (currentMessage.length > split_length)
			messages.push(...splitHtmlAware(currentMessage, split_length))
		else
			messages.push(currentMessage)

	return messages.filter(msg => msg.trim().length)
}

/**
 * 智能分割 HTML 字符串，避免截断标签。
 * @param {string} longString - 长 HTML 字符串。
 * @param {number} maxLength - 最大长度。
 * @returns {string[]} - 分割后的字符串数组。
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

	if (remainingString.length)
		chunks.push(remainingString)

	return chunks
}

/**
 * 构造供 Bot 核心逻辑层使用的统一逻辑频道 ID。
 * 在 Telegram 中，这通常结合了 chat ID 和可选的 message thread ID。
 * @param {string | number} chatId - Telegram 的 chat ID。
 * @param {number | undefined} threadId - (可选) Telegram 的 message_thread_id。
 * @returns {string} - 格式化后的逻辑频道 ID，例如 "CHATID_THREADID" 或 "CHATID"。
 */
export function constructLogicalChannelId(chatId, threadId) {
	if (threadId !== undefined && threadId !== null)
		return `${chatId}_${threadId}`
	return String(chatId)
}

/**
 * 从 Bot 核心逻辑层使用的逻辑频道 ID 解析出 Telegram 的 chat ID 和可选的 thread ID。
 * @param {string | number} logicalChannelId - 逻辑频道 ID。
 * @returns {{chatId: string, threadId?: number}} - 包含 `chatId` 和可选 `threadId` 的对象。
 */
export function parseLogicalChannelId(logicalChannelId) {
	const idStr = String(logicalChannelId)
	if (idStr.includes('_')) {
		const parts = idStr.split('_')
		return { chatId: parts[0], threadId: parseInt(parts[1], 10) }
	}
	return { chatId: idStr }
}
