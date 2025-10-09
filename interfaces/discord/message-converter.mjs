import { Buffer } from 'node:buffer'

import { ChannelType } from 'npm:discord.js'

import { charname as BotFountCharname } from '../../charbase.mjs'
import { mimetypeFromBufferAndName } from '../../scripts/mimetype.mjs'
import { tryFewTimes } from '../../scripts/tryFewTimes.mjs'

import { discordClientInstance, discordUserCache, discordUserIdToDisplayName, discordDisplayNameToId, aiReplyObjectCache } from './state.mjs'
import { getMessageFullContent } from './utils.mjs'

/**
 * @typedef {import('./config.mjs').DiscordInterfaceConfig_t} DiscordInterfaceConfig_t
 */
/**
 * @typedef {import('../../bot_core/index.mjs').chatLogEntry_t_ext} chatLogEntry_t_ext
 */
/**
 * @typedef {import('npm:discord.js').Message} DiscordMessage
 */

/**
 * 将 Discord 消息对象转换为 Bot 逻辑层可以理解的 Fount 聊天日志条目格式。
 * @async
 * @param {DiscordMessage} message - 从 Discord 收到的原始消息对象。
 * @param {DiscordInterfaceConfig_t} interfaceConfig - 当前 Discord 接口的配置对象。
 * @returns {Promise<chatLogEntry_t_ext | null>} 转换后的 Fount 聊天日志条目。如果消息无效或不应处理 (如系统消息)，则返回 null。
 */
export async function discordMessageToFountChatLogEntry(message, interfaceConfig) {
	const author = discordUserCache[message.author.id] || message.author
	if (!discordUserCache[message.author.id] || Math.random() < 0.1)
		try {
			const fetchedUser = await message.author.fetch()
			discordUserCache[message.author.id] = fetchedUser
		}
		catch (fetchError) {
			console.warn(`[DiscordInterface] Failed to fetch user info for ${message.author.id}:`, fetchError.message)
		}

	let senderName = author.displayName || author.globalName || author.username
	if (author.username && author.username.toLowerCase() !== senderName.toLowerCase())
		senderName += ` (${author.username})`

	discordUserIdToDisplayName[author.id] = senderName

	if (author.id === discordClientInstance.user?.id) {
		const botDisplayName = discordClientInstance.user.displayName || discordClientInstance.user.globalName || BotFountCharname
		discordDisplayNameToId[botDisplayName] = author.id
		discordDisplayNameToId[BotFountCharname] = author.id
		discordUserIdToDisplayName[author.id] = `${botDisplayName} (咱自己)`
		senderName = discordUserIdToDisplayName[author.id]
	}

	const content = await getMessageFullContent(message, discordClientInstance)

	// 准备一个数组来存放所有需要下载的文件/图片的 Promise
	const allFilePromises = []
	const processedUrls = new Set() // 使用 Set 来防止重复下载同一个 URL

	// 1. 解析并下载自定义表情
	const emojiRegex = /<(a?):(\w+):(\d+)>/g
	let emojiMatch
	while ((emojiMatch = emojiRegex.exec(content)) !== null) {
		const isAnimated = emojiMatch[1] === 'a'
		const emojiName = emojiMatch[2]
		const emojiId = emojiMatch[3]
		const extension = isAnimated ? 'gif' : 'png'
		const mimeType = `image/${extension}`
		const url = `https://cdn.discordapp.com/emojis/${emojiId}.${extension}`

		if (processedUrls.has(url)) continue
		processedUrls.add(url)

		allFilePromises.push(async () => {
			try {
				const buffer = Buffer.from(await tryFewTimes(() => fetch(url).then(response => response.arrayBuffer())))
				return {
					name: `${emojiName}.${extension}`,
					buffer,
					description: `Custom emoji: ${emojiName}`,
					mime_type: mimeType,
					extension: { is_from_vision: true },
				}
			}
			catch (error) {
				console.error(`[DiscordInterface] Failed to download custom emoji ${emojiName}:`, error)
				return null
			}
		})
	}

	// 2. 下载贴纸 (Stickers)
	message.stickers.forEach(sticker => {
		if (sticker.format === 3) { // 3 is LOTTIE format, skip it
			console.log(`[DiscordInterface] Skipping Lottie sticker: ${sticker.name}`)
			return
		}
		if (!sticker.url) {
			console.error('[DiscordInterface] Sticker has no url:', sticker)
			return
		}
		if (processedUrls.has(sticker.url)) return
		processedUrls.add(sticker.url)

		allFilePromises.push(async () => {
			try {
				const buffer = Buffer.from(await tryFewTimes(() => fetch(sticker.url).then(response => response.arrayBuffer())))
				const fileName = sticker.url.split('/').pop() || `${sticker.name}.png`
				return {
					name: fileName,
					buffer,
					description: `Sticker: ${sticker.name}`,
					mime_type: await mimetypeFromBufferAndName(buffer, fileName),
					extension: { is_from_vision: true },
				}
			}
			catch (error) {
				console.error(`[DiscordInterface] Failed to download sticker ${sticker.name}:`, error)
				return null
			}
		})
	})

	// 3. 收集所有附件 (包括原始消息和所有转发/引用快照中的附件)
	const allAttachments = [
		...message.attachments.values(),
		...message.messageSnapshots.values().flatMap(snapshot => [...snapshot.attachments.values()])
	]

	allAttachments.forEach(attachment => {
		if (!attachment || !attachment.url) {
			console.error('[DiscordInterface] Attachment has no url:', attachment)
			return
		}
		if (processedUrls.has(attachment.url)) return
		processedUrls.add(attachment.url)

		allFilePromises.push(async () => {
			try {
				const buffer = Buffer.from(await tryFewTimes(() => fetch(attachment.url).then(response => response.arrayBuffer())))
				return {
					name: attachment.name,
					buffer,
					description: attachment.description || '',
					mime_type: attachment.contentType || await mimetypeFromBufferAndName(buffer, attachment.name)
				}
			}
			catch (error) {
				console.error(`[DiscordInterface] Failed to download attachment ${attachment.name}:`, error)
				return null
			}
		})
	})

	// 4. 下载嵌入内容中的图片 (Embeds)
	message.embeds.forEach(embed => {
		// 同时考虑 image 和 thumbnail
		const imageUrl = embed.image?.url
		const thumbnailUrl = embed.thumbnail?.url

		for (const url of [imageUrl, thumbnailUrl]) {
			if (!url) continue
			if (processedUrls.has(url)) continue
			processedUrls.add(url)

			allFilePromises.push(async () => {
				try {
					const buffer = Buffer.from(await tryFewTimes(() => fetch(url).then(response => response.arrayBuffer())))
					const fileName = url.split('/').pop()?.split('?')[0] || 'embedded_image.png'
					return {
						name: fileName,
						buffer,
						description: embed.title || embed.description || '',
						mime_type: await mimetypeFromBufferAndName(buffer, fileName) || 'image/png',
						extension: { is_from_vision: true }
					}
				}
				catch (error) {
					console.error(`[DiscordInterface] Failed to download embedded image from ${url}:`, error)
					return null
				}
			})
		}
	})

	if (!content && !allFilePromises.length) return null

	const isDirectMessage = message.channel.type === ChannelType.DM
	const isFromOwner = message.author.username === interfaceConfig.OwnerUserName
	const mentionsBot = message.mentions.users.has(discordClientInstance.user?.id || '') ||
		(BotFountCharname && content.toLowerCase().includes(BotFountCharname.toLowerCase()))

	const mentionsOwner = message.mentions.users.some(user => user.username === interfaceConfig.OwnerUserName)

	/** @type {chatLogEntry_t_ext} */
	const fountEntry = {
		...aiReplyObjectCache[message.id],
		time_stamp: message.editedTimestamp || message.createdTimestamp,
		role: isFromOwner ? 'user' : 'char',
		name: senderName,
		content,
		files: allFilePromises,
		extension: {
			platform: 'discord',
			OwnerNameKeywords: interfaceConfig.OwnerNameKeywords,
			platform_message_ids: [message.id],
			content_parts: [content],
			platform_channel_id: message.channel.id,
			platform_user_id: message.author.id,
			platform_guild_id: message.guild?.id,
			is_direct_message: isDirectMessage,
			is_from_owner: isFromOwner,
			mentions_bot: mentionsBot,
			mentions_owner: mentionsOwner,
			discord_message_obj: message,
			...aiReplyObjectCache[message.id]?.extension,
		}
	}
	delete aiReplyObjectCache[message.id]
	return fountEntry
}
