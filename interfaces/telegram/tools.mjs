import { escapeHTML } from '../../scripts/tools.mjs'

/**
 * @file Telegram Interface Tools
 * @description Provides utility functions for the Telegram interface,
 * including Markdown/HTML escaping, message splitting, and conversion
 * between Telegram message entities and an AI-friendly Markdown dialect.
 */

/**
 * Telegram Bot API 用户信息对象 (部分)。
 * @typedef {import('npm:telegraf/typings/core/types/typegram').UserFromGetMe} TelegramBotInfo
 */
/**
 * Telegram 消息对象 (部分)。
 * @typedef {import('npm:telegraf/typings/core/types/typegram').Message} TelegramMessageType
 */
/**
 * Telegram 消息实体对象。
 * @typedef {import('npm:telegraf/typings/core/types/typegram').MessageEntity} TelegramMessageEntity
 */

/**
 * 转义 Telegram MarkdownV2 特殊字符。
 * 根据 Telegram Bot API 文档:
 * In all other places characters '_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'
 * must be escaped with the preceding character '\'.
 * 主要在明确需要 MarkdownV2 输出且不使用 HTML 时使用。
 * @param {string} text - 需要转义的文本。
 * @returns {string} 转义后的文本。
 */
export function escapeMarkdownV2(text) {
	if (!text) return ''
	return text.replace(/([!#()*+.=>?[\]_`{|}~\-])/g, '\\$1')
}

/**
 * 将 Telegram 消息文本和实体转换为 AI 方言 Markdown。
 * AI 方言 Markdown 支持:
 * - `**bold**`
 * - `*italic*`
 * - `__underline__`
 * - `~~strikethrough~~`
 * - `||spoiler||`
 * - `` `code` ``
 * - ````language\ncode block\n````
 * - `[text](url)`
 * - `> quoted text` (回复会被转换为这种形式)
 * - `@[User Name (UserID:123456789)]` (for text_mention)
 *
 * @param {string | undefined} text - 原始消息文本 (可能来自 message.text 或 message.caption)。
 * @param {TelegramMessageEntity[] | undefined} entities - Telegram 消息实体数组 (来自 message.entities 或 message.caption_entities)。
 * @param {TelegramBotInfo | undefined} botInfo - 机器人自身信息，用于格式化对自身的回复。
 * @param {TelegramMessageType | undefined} replyToMessage - 被回复的 Telegram 消息对象。
 * @returns {string} 转换后的 AI 方言 Markdown 文本。
 */
export function telegramEntitiesToAiMarkdown(text, entities, botInfo, replyToMessage) {
	let aiMarkdown = ''

	// 1. 处理回复: 将被回复的消息转换为 AI 方言的引用格式
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

		// 对被回复消息的文本内容进行一个简短的预览，并尝试也转换为 AI Markdown
		let repliedPreview = '' // 默认预览
		if (repliedTextContent) {
			const maxLength = 80
			const isTruncated = repliedTextContent.length > maxLength
			const previewText = repliedTextContent.substring(0, maxLength) + (isTruncated ? '...' : '')
			// 转换这个预览文本 (不递归 botInfo 和 replyToMessage 以避免无限循环)
			repliedPreview = telegramEntitiesToAiMarkdown(previewText, repliedEntities, undefined, undefined)
		} else if (replyToMessage.photo)
			repliedPreview = '[图片]'
		else if (replyToMessage.video)
			repliedPreview = '[视频]'
		else if (replyToMessage.voice)
			repliedPreview = '[语音]'
		else if (replyToMessage.document)
			repliedPreview = `[文件: ${replyToMessage.document.file_name || '未知'}]`

		// 将预览文本的每一行都加上 '>'
		if (repliedPreview) {
			aiMarkdown += repliedPreview.split('\n').map(line => `> ${line}`).join('\n')
			aiMarkdown += `\n(回复 ${replierName})\n\n`
		}
	}

	if (!text) return aiMarkdown.trim() // 如果原始消息没有文本内容 (只有附件或仅为回复)，则返回已处理的回复部分

	const textChars = Array.from(text) // 使用 Array.from 处理 UTF-16 代理对
	if (!entities || entities.length === 0)
		// 如果没有实体，直接附加原始文本（可能已包含用户手动输入的 '>' 作为引用）
		return aiMarkdown + text


	const parts = []
	let lastOffset = 0

	// 对实体按 offset 排序，以正确处理
	const sortedEntities = [...entities].sort((a, b) => a.offset - b.offset)

	for (const entity of sortedEntities) {
		// 添加实体前的普通文本
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
			case 'code': // 行内代码
				formattedEntityText = `\`${entityText}\``
				break
			case 'pre': // 代码块
				formattedEntityText = '```' + (entity.language ? entity.language : '') + '\n' + entityText + '\n```'
				break
			case 'text_link':
				formattedEntityText = `[${entityText}](${entity.url})`
				break
			case 'blockquote': // Telegram 6.7+ blockquote entity
				// AI 方言直接使用 '>' 前缀，所以这里将多行 blockquote 文本每行加上 '>'
				formattedEntityText = entityText.split('\n').map(line => `> ${line}`).join('\n')
				break
			case 'text_mention': // 提及用户（点击会显示用户信息）
				formattedEntityText = `@[${entityText} (UserID:${entity.user.id})]`
				break
			// 以下类型通常直接传递给 AI，因为它们本身就是可读信息
			case 'mention': // @username
			case 'hashtag': // #hashtag
			case 'cashtag': // $USD
			case 'bot_command': // /start@botname
			case 'url': // http://link.com (如果 text_link 不存在，Telegram 会自动链接)
			case 'email': // user@example.com
			case 'phone_number': // +11234567890
				// 这些保持原样，AI能理解
				formattedEntityText = entityText
				break
			default:
				formattedEntityText = entityText // 未知或不特殊处理的实体类型
		}
		parts.push(formattedEntityText)
		lastOffset = entity.offset + entity.length
	}

	// 添加最后一个实体后的剩余文本
	if (lastOffset < textChars.length)
		parts.push(textChars.slice(lastOffset).join(''))

	aiMarkdown += parts.join('')

	return aiMarkdown.trim()
}

/**
 * 将 AI 方言 Markdown 转换为 Telegram HTML 格式。
 * 输入的 AI 方言 Markdown 已在 {@link telegramEntitiesToAiMarkdown} 中定义。
 * 输出的 HTML 遵循 Telegram Bot API 的 HTML 风格指南。
 * @param {string} aiMarkdownText - 包含 AI 方言 Markdown 的文本。
 * @returns {string} 转换后的 Telegram HTML 文本。
 */
export function aiMarkdownToTelegramHtml(aiMarkdownText) {
	if (!aiMarkdownText) return ''

	// 步骤 A: 首先对整个输入字符串进行 HTML 转义。
	// 这样可以确保所有用户输入的普通文本中的特殊字符 (<, >, &, ", ') 都被安全处理。
	let html = escapeHTML(aiMarkdownText)

	// 步骤 B: 现在，将已转义文本中的 AI 方言 Markdown 标记替换为 HTML 标签。
	// 注意：此时 Markdown 的内容部分 (如 **bold text** 中的 "bold text") 也已经被转义了。
	// 这对于简单标签 (<b>, <i> etc.) 是期望的行为，因为它们的内容应该是纯文本或已转义的 HTML。

	// 1. 代码块 (```lang\ncode\n``` or ```\ncode\n```)
	//    内容 (code) 已经是转义过的。语言标识符 (lang) 也需要转义以防万一。
	html = html.replace(/```(\w*)\n([\S\s]*?)\n```/g, (match, lang, code) => {
		// lang 来自原始 Markdown，可能包含特殊字符，所以 escapeHTML(lang) 是安全的。
		// code 来自已执行 escapeHTML(aiMarkdownText) 的结果，所以它已经是转义过的。
		const langClass = lang ? ` class="language-${escapeHTML(lang)}"` : ''
		return `<pre><code${langClass}>${code}</code></pre>`
	})

	// 2. 行内代码 (`)
	//    内容 (code) 已经是转义过的。
	html = html.replace(/(?<!\\)`([^\n`]+?)(?<!\\)`/g, (match, code) => `<code>${code}</code>`)

	// 3. 链接: `[text](url)`
	//    text 和 url 都已经是转义过的。
	//    对于 URL，&amp; 通常是可接受的。如果 URL 中的 " 被转义为 &quot;，这在 href 属性中也是有效的。
	html = html.replace(/\[(.*?)]\((.*?)\)/g, (match, text, url) => {
		return `<a href="${url}">${text}</a>` // text 和 url 都是转义过的
	})

	// 4. 剧透: ||spoiler||
	//    内容 (content) 已经是转义过的。
	html = html.replace(/\|\|(.*?)\|\|/g, (match, content) => `<tg-spoiler>${content}</tg-spoiler>`)

	// 5. 基本格式化: **text**, *text*, __text__, ~~text~~
	//    $1 (捕获组内容) 已经是转义过的。
	html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
	// 要注意 '*' 和 '**' 的匹配顺序或使用更精确的正则避免冲突
	// 下面的正则试图通过lookarounds避免匹配 `**` 内的 `*` 或单词中的 `*` (如 a*b)
	// 但由于整个字符串已预先转义，`*` 字符本身不受影响。
	html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<i>$1</i>') // 确保这个正则在 **text** 之后或能正确处理
	html = html.replace(/__(.+?)__/g, '<u>$1</u>')
	html = html.replace(/~~(.+?)~~/g, '<s>$1</s>')


	// 6. 处理引用 (以 `> ` 开头的行)
	//    因为整个文本已经用 escapeHTML 处理过，所以原始的 `>` 字符会变成 `&gt;`。
	//    我们需要根据 `&gt;` 来识别和处理块引用。
	const lines = html.split('\n')
	let inBlockquote = false
	const processedLines = []
	const blockquoteStartTag = '&gt; ' // Markdown的 '>' 在HTML转义后是 '&gt;'

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		if (line.startsWith(blockquoteStartTag)) {
			const quoteContent = line.substring(blockquoteStartTag.length) // 内容已经是转义过的
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
			processedLines.push(line) // 这部分行内容也已经是转义过的
		}
	}
	if (inBlockquote)  // 确保闭合最后的块引用
		processedLines.push('</blockquote>')

	html = processedLines.join('\n')

	// Telegram 通常会将 \n 视作换行符，在 <pre> 和 <blockquote> 中也是如此。
	return html
}

/**
 * 分割 Telegram 回复文本以适应其消息长度限制。
 * Telegram 的主要限制:
 * - 文本消息: 4096 字符 (HTML 或 MarkdownV2 格式化后)
 * - 图片/视频等媒体的标题 (Caption): 1024 字符 (HTML 或 MarkdownV2 格式化后)
 * 此函数尝试按换行符和指定长度分割。
 *
 * @param {string} reply - 原始回复文本。
 * @param {number} [split_length=4096] - 每条消息的最大长度。对于标题，应使用 1024。
 * @returns {string[]} 分割后的消息片段数组。
 */
export function splitTelegramReply(reply, split_length = 4096) {
	if (!reply) return []
	// 对于HTML内容，字符长度计算可能需要更保守，因为标签也占字符。
	// 但Telegram的限制是针对最终的UTF-8字节流或字符数，这里以字符数为准。

	const messages = []
	let currentMessage = ''
	const lines = reply.split('\n') // 优先按自然换行分割

	for (const line of lines)
		// 检查添加下一行（包括换行符）是否会超出长度
		if (currentMessage.length + (currentMessage ? 1 : 0) + line.length <= split_length) {
			if (currentMessage)
				currentMessage += '\n'

			currentMessage += line
		} else
			// 当前行本身就超长
			if (line.length > split_length) {
				if (currentMessage) { // 推送之前累积的消息
					messages.push(currentMessage)
					currentMessage = ''
				}
				// 硬分割超长行
				// TODO: 对于HTML，硬分割可能破坏标签。需要更智能的分割。
				// 暂时简单处理，实际应用中可能需要HTML感知分割器。
				for (let i = 0; i < line.length; i += split_length)
					messages.push(line.substring(i, Math.min(i + split_length, line.length)))

			} else { // 当前行不超长，但加上它 currentMessage 就超长了
				if (currentMessage)
					messages.push(currentMessage)

				currentMessage = line
			}



	// 推送最后剩余的 currentMessage
	if (currentMessage)
		messages.push(currentMessage)


	return messages.filter(msg => msg.trim().length > 0) // 过滤掉可能产生的空字符串
}
