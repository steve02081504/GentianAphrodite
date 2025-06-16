import { Events, ChannelType, ActivityType } from 'npm:discord.js'
import { Buffer } from 'node:buffer'

import { processIncomingMessage, processMessageUpdate, processMessageDelete, cleanup as cleanupBotLogic, registerPlatformAPI } from '../../bot_core/index.mjs'
import { charname as BotFountCharname } from '../../charbase.mjs'

import { get_discord_api_plugin } from './api.mjs'
import { discordWorld } from './world.mjs'
import { getMessageFullContent, splitDiscordReply } from './tools.mjs'
import { tryFewTimes } from '../../scripts/tryFewTimes.mjs'
import { mimetypeFromBufferAndName } from '../../scripts/mimetype.mjs'
import { escapeRegExp } from '../../scripts/tools.mjs'

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
/**
 * Discord.js 的消息对象类型。
 * @typedef {import('npm:discord.js').Message} DiscordMessage
 */
/**
 * Discord.js 的文本频道对象类型。
 * @typedef {import('npm:discord.js').TextChannel} DiscordTextChannel
 */
/**
 * Discord.js 的私聊频道对象类型。
 * @typedef {import('npm:discord.js').DMChannel} DiscordDMChannel
 */
/**
 * Discord.js 的用户对象类型。
 * @typedef {import('npm:discord.js').User} DiscordUser
 */
/**
 * Discord.js 的服务器成员对象类型。
 * @typedef {import('npm:discord.js').GuildMember} DiscordGuildMember
 */

/**
 * Discord 接入层配置对象类型定义。
 * @typedef {{
 *  OwnerUserName: string,
 *  OwnerDiscordID?: string,
 *  OwnerNameKeywords: string[],
 *  BotActivityName?: string,
 *  BotActivityType?: keyof typeof ActivityType,
 * }} DiscordInterfaceConfig_t
 */

/**
 * 获取此 Discord 接口的配置模板。
 * @returns {DiscordInterfaceConfig_t} 配置模板对象。
 */
export function GetBotConfigTemplate() {
	return {
		OwnerUserName: 'your_discord_username',
		OwnerDiscordID: 'your_discord_user_id',
		OwnerNameKeywords: [
			'your_name_keyword1',
			'your_name_keyword2',
		],
		BotActivityName: '主人',
		BotActivityType: 'Watching',
	}
}

/**
 * Discord.js 客户端实例的引用。
 * @type {Client}
 */
let discordClientInstance

/**
 * 缓存的主人 Discord 用户 ID。
 * @type {string | null}
 */
let resolvedOwnerId = null

/**
 * Discord 用户对象缓存。
 * 键为用户 ID (string)，值为 Discord User 对象。
 * @type {Record<string, DiscordUser>}
 */
const discordUserCache = {}

/**
 * Discord 用户 ID到其规范化显示名称的映射。
 * 键为用户 ID (string)，值为用户显示名称 (string)。
 * @type {Record<string, string>}
 */
const discordUserIdToDisplayName = {}

/**
 * Discord 用户规范化显示名称到其用户 ID 的映射。
 * 键为显示名称 (string)，值为用户 ID (string)。
 * @type {Record<string, string>}
 */
const discordDisplayNameToId = {}

/**
 * 缓存由 AI 生成并已发送的 FountChatReply_t 对象。
 * 键为第一条成功发送的 Discord 消息的 ID (string)，值为原始的 {@link FountChatReply_t} 对象。
 * @type {Record<string, FountChatReply_t>}
 */
const aiReplyObjectCache = {}

/**
 * 将 Discord 消息对象转换为 Bot 逻辑层可以理解的 Fount 聊天日志条目格式。
 * @async
 * @param {DiscordMessage} message - 从 Discord 收到的原始消息对象。
 * @param {DiscordInterfaceConfig_t} interfaceConfig - 当前 Discord 接口的配置对象。
 * @returns {Promise<chatLogEntry_t_ext | null>} 转换后的 Fount 聊天日志条目。如果消息无效或不应处理 (如系统消息)，则返回 null。
 */
async function discordMessageToFountChatLogEntry(message, interfaceConfig) {
	const author = discordUserCache[message.author.id] || message.author
	if (!discordUserCache[message.author.id] || Math.random() < 0.1)
		try {
			const fetchedUser = await message.author.fetch()
			discordUserCache[message.author.id] = fetchedUser
		} catch (fetchError) {
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

	const files = (await Promise.all([...[
		message.attachments,
		...message.messageSnapshots.map(referencedMessage => referencedMessage.attachments)
	].flatMap(x => x.map(x => x)).filter(Boolean).map(async (attachment) => {
		if (!attachment.url) {
			console.error('[DiscordInterface] attachment has no url:', attachment)
			return null
		}
		try {
			const buffer = Buffer.from(await tryFewTimes(
				() => fetch(attachment.url).then((response) => response.arrayBuffer())
			))
			return {
				name: attachment.name,
				buffer,
				description: attachment.description,
				mimeType: attachment.contentType || await mimetypeFromBufferAndName(buffer, attachment.name)
			}
		}
		catch (error) {
			console.error(error)
		}
	}), ...message.embeds.map(embed => embed.image?.url).filter(url => url).map(async url => {
		try {
			return {
				name: url.split('/').pop(),
				buffer: Buffer.from(await tryFewTimes(
					() => fetch(url).then((response) => response.arrayBuffer())
				)),
				description: '',
				mimeType: 'image/png'
			}
		}
		catch (error) {
			console.error(error)
		}
	})])).filter(Boolean)

	if (!content && files.length === 0) return null

	const isDirectMessage = message.channel.type === ChannelType.DM
	const isFromOwner = message.author.username === interfaceConfig.OwnerUserName
	const mentionsBot = message.mentions.users.has(discordClientInstance.user?.id || '') ||
		(BotFountCharname && content.toLowerCase().includes(BotFountCharname.toLowerCase()))

	const mentionsOwner = message.mentions.users.some(user => user.username === interfaceConfig.OwnerUserName)

	/** @type {chatLogEntry_t_ext} */
	const fountEntry = {
		timeStamp: message.editedTimestamp || message.createdTimestamp,
		role: isFromOwner ? 'user' : 'char',
		name: senderName,
		content,
		files,
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

/**
 * 格式化文本中的提及，将 @用户名 转换为 <@用户ID>。
 * @param {string} text - 原始文本。
 * @param {Map<string, string>} [guildMembersMap] - (可选) 一个 Map 对象，键为小写的用户名或显示名，值为用户ID。
 * @returns {string} 格式化后的文本。
 */
function formatEmbedMentions(text, guildMembersMap) {
	if (!text || !guildMembersMap || guildMembersMap.size === 0)
		return text

	const sortedNames = Array.from(guildMembersMap.keys()).sort((a, b) => b.length - a.length)

	if (sortedNames.length === 0)
		return text

	const mentionRegex = new RegExp(`@(${sortedNames.map(name => escapeRegExp(name)).join('|')})(?!\\w)`, 'gi')

	return text.replace(mentionRegex, (match, matchedName) => {
		const userId = guildMembersMap.get(matchedName.toLowerCase())
		if (userId)
			return `<@${userId}>`

		return match
	})
}

/**
 * Discord Bot 的主设置和事件处理函数。
 * @param {Client} client - 已初始化的 Discord.js 客户端实例。
 * @param {DiscordInterfaceConfig_t} interfaceConfig - 传递给此 Discord 接口的特定配置对象。
 */
export async function DiscordBotMain(client, interfaceConfig) {
	discordClientInstance = client

	/**
	 * 构建并返回一个实现了 {@link PlatformAPI_t} 接口的对象。
	 * @type {PlatformAPI_t}
	 */
	const discordPlatformAPI = {
		name: 'discord',
		config: interfaceConfig,

		/**
		 * 发送消息到指定的 Discord 频道。
		 * @param {string | number} channelId - 目标 Discord 频道的 ID。
		 * @param {FountChatReply_t} fountReplyPayload - 由 Bot 逻辑层生成的、包含回复内容的 Fount 回复对象。
		 * @param {chatLogEntry_t_ext} [originalMessageEntry] - (可选) 触发此次回复的原始消息条目，用于在 Discord 上下文显示为“回复”。
		 * @returns {Promise<chatLogEntry_t_ext | null>} 如果发送成功，则返回代表第一条已发送消息的 Fount 日志条目；否则返回 null。
		 */
		async sendMessage(channelId, fountReplyPayload, originalMessageEntry) {
			const channel = await client.channels.fetch(String(channelId)).catch(() => null)
			if (!channel || !(channel.isTextBased() || channel.type === ChannelType.DM)) {
				console.error(`[DiscordInterface] sendMessage: Invalid channel or channel not found: ${channelId}`)
				return null
			}

			let repliedToDiscordMessage
			if (originalMessageEntry?.extension?.platform_message_ids?.length)
				try {
					repliedToDiscordMessage = await /** @type {DiscordTextChannel | DiscordDMChannel} */ channel.messages.fetch(originalMessageEntry.extension.platform_message_ids.slice(-1)[0])
				} catch { /* 原始消息可能已被删除，静默处理，后续发送时不使用 .reply() */ }

			const textContent = fountReplyPayload.content || ''
			const filesToSend = (fountReplyPayload.files || []).map(f => ({
				attachment: f.buffer, name: f.name || 'file.dat', description: f.description
			}))

			const splitTexts = splitDiscordReply(textContent, 2000)
			let firstSentDiscordMessage = null
			const guildMembersMap = new Map()

			if (channel.type !== ChannelType.DM && textContent.includes('@'))
				try {
					const guild = client.guilds.cache.get(channel.guildId)
					if (guild) {
						const membersCollection = guild.members.cache
						membersCollection.forEach(member => {
							guildMembersMap.set(member.user.username.toLowerCase(), member.id)
							if (member.displayName) guildMembersMap.set(member.displayName.toLowerCase(), member.id)
						})
					}
				} catch (err) { /* 静默处理，获取成员缓存失败通常不关键 */ }

			if (splitTexts.length === 0 && filesToSend.length > 0)
				try {
					const sentMsg = repliedToDiscordMessage
						? await repliedToDiscordMessage.reply({ files: filesToSend, allowedMentions: { repliedUser: true } })
						: await /** @type {DiscordTextChannel | DiscordDMChannel} */ channel.send({ files: filesToSend })
					firstSentDiscordMessage = sentMsg
				} catch (e) { console.error('[DiscordInterface] Failed to send file-only message:', e) }
			else
				for (let i = 0; i < splitTexts.length; i++) {
					const textPart = formatEmbedMentions(splitTexts[i], guildMembersMap)
					const isLastPart = i === splitTexts.length - 1
					try {
						const messageOptions = {
							content: textPart,
							files: isLastPart ? filesToSend : [],
							allowedMentions: { parse: ['users', 'roles'], repliedUser: !!repliedToDiscordMessage }
						}
						const sentMsg = repliedToDiscordMessage && i === 0
							? await repliedToDiscordMessage.reply(messageOptions)
							: await /** @type {DiscordTextChannel | DiscordDMChannel} */ channel.send(messageOptions)

						if (i === 0) firstSentDiscordMessage = sentMsg
						if (repliedToDiscordMessage && i === 0) repliedToDiscordMessage = undefined
					} catch (e) { console.error(`[DiscordInterface] Failed to send message segment ${i + 1}:`, e); break }
				}

			if (firstSentDiscordMessage) {
				if (fountReplyPayload && (fountReplyPayload.content || fountReplyPayload.files?.length))
					aiReplyObjectCache[firstSentDiscordMessage.id] = fountReplyPayload

				return await discordMessageToFountChatLogEntry(firstSentDiscordMessage, interfaceConfig)
			}
			return null
		},

		/**
		 * 在指定频道发送“正在输入...”状态。
		 * @param {string | number} channelId - 目标 Discord 频道的 ID。
		 * @returns {Promise<void>}
		 */
		async sendTyping(channelId) {
			const channel = client.channels.cache.get(String(channelId))
			if (channel?.isTextBased())
				try {
					await /** @type {DiscordTextChannel | DiscordDMChannel} */ channel.sendTyping()
				} catch (e) { /* 发送 typing 状态失败通常不关键，静默处理 */ }
		},

		/**
		 * 获取指定 Discord 频道的历史消息。
		 * @param {string | number} channelId - 目标 Discord 频道的 ID。
		 * @param {number} limit - 要获取的消息数量上限。
		 * @returns {Promise<chatLogEntry_t_ext[]>} 转换后的 Fount 聊天日志条目数组 (按时间从旧到新排序)。
		 */
		async fetchChannelHistory(channelId, limit) {
			const channel = await client.channels.fetch(String(channelId)).catch(() => null)
			if (!channel || !channel.isTextBased()) return []

			try {
				const messages = await /** @type {DiscordTextChannel | DiscordDMChannel} */ channel.messages.fetch({ limit })
				const fountEntries = (await Promise.all(
					messages.map(msg => discordMessageToFountChatLogEntry(msg, interfaceConfig))
				)).filter(Boolean).reverse()
				return fountEntries
			} catch (e) {
				console.error(`[DiscordInterface] Failed to fetch channel ${channelId} history:`, e)
				return []
			}
		},

		/** 获取机器人自身的 Discord 用户 ID。 */
		getBotUserId: () => client.user?.id || '',
		/** 获取机器人自身的 Discord 用户名。 */
		getBotUsername: () => client.user?.username || BotFountCharname,
		/** 获取主人的 Discord 用户名。 */
		getOwnerUserName: () => interfaceConfig.OwnerUserName,
		/** 获取主人的 Discord 用户 ID。 */
		getOwnerUserId: () => resolvedOwnerId,
		/** 获取机器人自身的 Discord 显示名称 (服务器昵称或全局显示名)。 */
		getBotDisplayName: () => client.user?.displayName || client.user?.globalName || client.user?.username || BotFountCharname,

		/**
		 * 获取供 AI 使用的、易读的聊天/频道名称。
		 * @param {string | number} channelId - 频道 ID。
		 * @param {chatLogEntry_t_ext} [triggerMessage] - (可选) 触发消息，用于私聊时获取对方用户名。
		 * @returns {string} 格式化后的聊天/频道名称。
		 */
		getChatNameForAI: (channelId, triggerMessage) => {
			const channel = client.channels.cache.get(String(channelId))
			if (!channel) return `Discord: Unknown Channel ${channelId}`
			if (channel.type === ChannelType.DM) {
				const recipient = triggerMessage?.extension?.discord_message_obj?.channel?.recipient
				return `Discord: DM with ${recipient?.tag || recipient?.username || 'User'}`
			}
			if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice) {
				const guildName = /** @type {DiscordTextChannel} */ channel.guild.name
				const channelName = /** @type {DiscordTextChannel} */ channel.name
				return `Discord: Guild ${guildName}: #${channelName}`
			}
			return `Discord: Channel ${channelId}`
		},

		/**
		 * 通知接入层执行机器人销毁/下线操作。
		 * @returns {Promise<void>}
		 */
		destroySelf: async () => {
			await cleanupBotLogic()
			client.destroy()
		},

		/**
		 * 记录从 Bot 逻辑层传递过来的错误。
		 * @param {Error} error - 错误对象。
		 * @param {chatLogEntry_t_ext} [contextMessage] - (可选) 发生错误时的上下文消息条目。
		 */
		logError: (error, contextMessage) => {
			console.error('[DiscordInterface-PlatformAPI-Error]', error, contextMessage ? `Context: ${JSON.stringify(contextMessage)}` : '')
		},

		/**
		 * 获取特定于 Discord 平台和当前消息上下文的插件列表。
		 * @param {chatLogEntry_t_ext} messageEntry - 当前正在处理的消息条目。
		 * @returns {Record<string, import('../../../../../../../src/decl/pluginAPI.ts').pluginAPI_t>} 插件对象映射。
		 */
		getPlatformSpecificPlugins: (messageEntry) => {
			if (messageEntry?.extension?.discord_message_obj)
				return {
					discord_api: get_discord_api_plugin(messageEntry.extension.discord_message_obj),
				}

			return {}
		},

		/** 获取特定于 Discord 平台的世界观配置。 */
		getPlatformWorld: () => discordWorld,

		/**
		 * (可选) 设置当主人离开群组时调用的回调函数。
		 * @param {(groupId: string | number, userId: string | number) => Promise<void>} onLeaveCallback - 回调函数。
		 */
		onOwnerLeaveGroup: (onLeaveCallback) => {
			client.on(Events.GuildMemberRemove, async (member) => {
				if (!member || !member.guild) {
					console.warn('[DiscordInterface] GuildMemberRemove event triggered with invalid member or guild data.')
					return
				}
				try {
					await onLeaveCallback(member.guild.id, String(member.id))
				} catch (e) {
					console.error(`[DiscordInterface] Error in onOwnerLeaveGroup callback for user ${member.id} in guild ${member.guild.id}:`, e)
				}
			})
		},

		/**
		 * (可选) 设置当机器人加入新群组/服务器时调用的回调函数。
		 * @param {(group: import('../../bot_core/index.mjs').GroupObject) => Promise<void>} onJoinCallback - 回调函数。
		 */
		onGroupJoin: (onJoinCallback) => {
			client.on(Events.GuildCreate, async (guild) => {
				console.log(`[DiscordInterface] Joined new guild: ${guild.name} (ID: ${guild.id})`)
				/** @type {import('../../bot_core/index.mjs').GroupObject} */
				const groupObject = {
					id: guild.id,
					name: guild.name,
					discordGuild: guild
				}
				try {
					await onJoinCallback(groupObject)
				} catch (e) {
					console.error(`[DiscordInterface] Error in onGroupJoin callback for guild ${guild.id}:`, e)
				}
			})
		},

		/**
		 * (可选) 获取机器人当前所在的所有群组/服务器列表。
		 * @returns {Promise<import('../../bot_core/index.mjs').GroupObject[]>}
		 */
		getJoinedGroups: async () => {
			if (!client.guilds) return []
			try {
				return Array.from(client.guilds.cache.values()).map(guild => ({
					id: guild.id,
					name: guild.name,
					discordGuild: guild
				}))
			} catch (error) {
				console.error('[DiscordInterface] Error fetching joined groups:', error)
				return []
			}
		},

		/**
		 * (可选) 获取特定群组/服务器的成员列表。
		 * @param {string | number} guildId - 服务器的 ID。
		 * @returns {Promise<import('../../bot_core/index.mjs').UserObject[]>}
		 */
		getGroupMembers: async (guildId) => {
			try {
				const guild = client.guilds.cache.get(String(guildId))
				if (!guild) {
					console.warn(`[DiscordInterface] getGroupMembers: Guild not found: ${guildId}`)
					return []
				}
				const members = await guild.members.fetch()
				return members.map(member => ({
					id: member.id,
					username: member.user.username,
					displayName: member.displayName,
					isBot: member.user.bot,
					discordMember: member
				}))
			} catch (error) {
				console.error(`[DiscordInterface] Error fetching group members for guild ${guildId}:`, error)
				return []
			}
		},

		/**
		 * (可选) 为指定群组/服务器生成邀请链接。
		 * @param {string | number} guildId - 服务器的 ID。
		 * @param {string | number} [channelId] - (可选) 用于生成邀请的频道 ID。
		 * @returns {Promise<string | null>} 邀请 URL 或 null。
		 */
		generateInviteLink: async (guildId, channelId) => {
			try {
				const guild = client.guilds.cache.get(String(guildId))
				if (!guild) {
					console.warn(`[DiscordInterface] generateInviteLink: Guild not found: ${guildId}`)
					return null
				}

				let targetChannel
				if (channelId) {
					const fetchedChannel = guild.channels.cache.get(String(channelId))
					if (fetchedChannel && fetchedChannel.type === ChannelType.GuildText && fetchedChannel.permissionsFor(client.user).has('CreateInstantInvite'))
						targetChannel = fetchedChannel
				}

				if (!targetChannel && guild.systemChannel && guild.systemChannel.type === ChannelType.GuildText && guild.systemChannel.permissionsFor(client.user).has('CreateInstantInvite'))
					targetChannel = guild.systemChannel

				if (!targetChannel)
					targetChannel = guild.channels.cache.find(ch =>
						ch.type === ChannelType.GuildText &&
						ch.permissionsFor(client.user).has('CreateInstantInvite')
					)

				if (targetChannel) {
					const invite = await targetChannel.createInvite({ maxAge: 0, maxUses: 0 })
					return invite.url
				} else {
					console.warn(`[DiscordInterface] generateInviteLink: No suitable text channel found to create invite for guild ${guildId} with CreateInstantInvite permission.`)
					return null
				}
			} catch (error) {
				console.error(`[DiscordInterface] Error generating invite link for guild ${guildId}:`, error)
				return null
			}
		},

		/**
		 * (可选) 使机器人离开指定群组/服务器。
		 * @param {string | number} guildId - 服务器的 ID。
		 * @returns {Promise<void>}
		 */
		leaveGroup: async (guildId) => {
			try {
				const guild = client.guilds.cache.get(String(guildId))
				if (guild)
					await guild.leave()
				else
					console.warn(`[DiscordInterface] leaveGroup: Guild not found: ${guildId}`)
			} catch (error) {
				console.error(`[DiscordInterface] Error leaving guild ${guildId}:`, error)
			}
		},

		/**
		 * (可选) 获取群组/服务器的默认或合适的首选频道。
		 * @param {string | number} guildId - 服务器的 ID。
		 * @returns {Promise<import('../../bot_core/index.mjs').ChannelObject | null>}
		 */
		getGroupDefaultChannel: async (guildId) => {
			try {
				const guild = client.guilds.cache.get(String(guildId))
				if (!guild) {
					console.warn(`[DiscordInterface] getGroupDefaultChannel: Guild not found: ${guildId}`)
					return null
				}

				if (guild.systemChannel && guild.systemChannel.type === ChannelType.GuildText)
					return {
						id: guild.systemChannel.id,
						name: guild.systemChannel.name,
						type: 'text',
						discordChannel: guild.systemChannel
					}

				const firstTextChannel = guild.channels.cache.find(ch => ch.type === ChannelType.GuildText)
				if (firstTextChannel)
					return {
						id: firstTextChannel.id,
						name: firstTextChannel.name,
						type: 'text',
						discordChannel: firstTextChannel
					}

				console.warn(`[DiscordInterface] getGroupDefaultChannel: No suitable text channel found in guild ${guildId}`)
				return null
			} catch (error) {
				console.error(`[DiscordInterface] Error getting default channel for guild ${guildId}:`, error)
				return null
			}
		},

		/**
		 * (可选) 优化方法：一次性获取主人在哪些群组中、不在哪些群组中。
		 * @returns {Promise<{groupsWithOwner: import('../../bot_core/index.mjs').GroupObject[], groupsWithoutOwner: import('../../bot_core/index.mjs').GroupObject[]} | null>}
		 */
		getOwnerPresenceInGroups: async () => {
			if (!client.user) {
				console.error('[DiscordInterface] getOwnerPresenceInGroups: client.user is not available. Bot might not be ready.')
				return null
			}

			const ownerIdToUse = resolvedOwnerId || interfaceConfig.OwnerDiscordID

			if (!ownerIdToUse) {
				console.warn('[DiscordInterface] getOwnerPresenceInGroups: Owner ID not resolved or configured. Cannot perform check.')
				return null
			}

			const groupsWithOwner = []
			const groupsWithoutOwner = []

			for (const guild of client.guilds.cache.values()) {
				const groupObject = {
					id: guild.id,
					name: guild.name,
					discordGuild: guild
				}
				try {
					const ownerMember = await guild.members.fetch(ownerIdToUse).catch(() => null)
					if (ownerMember)
						groupsWithOwner.push(groupObject)
					else
						groupsWithoutOwner.push(groupObject)

				} catch (e) {
					console.warn(`[DiscordInterface] Error checking owner presence in guild ${guild.name} (ID: ${guild.id}): ${e.message}. Assuming owner not present.`)
					groupsWithoutOwner.push(groupObject)
				}
			}
			return { groupsWithOwner, groupsWithoutOwner }
		},

		/**
		 * (可选) 向配置的机器人主人发送私信。
		 * @param {string} messageText - 要发送的消息文本。
		 * @returns {Promise<void>}
		 */
		sendDirectMessageToOwner: async (messageText) => {
			try {
				if (!interfaceConfig.OwnerUserName && !resolvedOwnerId) {
					console.error('[DiscordInterface] sendDirectMessageToOwner: OwnerUserName or resolved OwnerDiscordID is not configured.')
					return
				}

				let ownerUser = null
				if (resolvedOwnerId)
					ownerUser = await client.users.fetch(resolvedOwnerId).catch(() => null)


				if (!ownerUser && interfaceConfig.OwnerUserName)
					ownerUser = client.users.cache.find(user => user.username === interfaceConfig.OwnerUserName)


				if (!ownerUser && interfaceConfig.OwnerUserName) {
					console.warn(`[DiscordInterface] Owner user "${interfaceConfig.OwnerUserName}" not in cache/by ID, attempting to fetch across all guilds...`)
					for (const guild of client.guilds.cache.values())
						try {
							const members = await guild.members.fetch()
							const ownerMember = members.find(member => member.user.username === interfaceConfig.OwnerUserName)
							if (ownerMember) {
								ownerUser = ownerMember.user
								break
							}
						} catch (guildFetchError) {
							console.warn(`[DiscordInterface] Could not fetch members for guild ${guild.id} while searching for owner:`, guildFetchError.message)
						}
				}

				if (ownerUser)
					await ownerUser.send(messageText)
				else
					console.error(`[DiscordInterface] sendDirectMessageToOwner: Owner user ${interfaceConfig.OwnerUserName || resolvedOwnerId} not found.`)

			} catch (error) {
				console.error('[DiscordInterface] Error sending DM to owner:', error)
			}
		}
	}

	client.on(Events.MessageCreate, async (message) => {
		const fetchedMessage = await tryFewTimes(() => message.fetch().catch(e => {
			if (e.code === 10008) return null
			throw e
		}))
		if (!fetchedMessage)
			return console.log(`[DiscordInterface] Message ${message.id} not found or deleted, skipping processing.`)

		const fountEntry = await discordMessageToFountChatLogEntry(fetchedMessage, interfaceConfig)
		if (fountEntry)
			await processIncomingMessage(fountEntry, discordPlatformAPI, fetchedMessage.channel.id)
		else {
			console.warn(`[DiscordInterface] Received invalid message, possibly system message or unsupported format: ${fetchedMessage.id}`)
			console.dir(fetchedMessage, { depth: null })
		}
	})

	client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
		const fetchedNewMessage = await tryFewTimes(() => newMessage.fetch().catch(e => {
			if (e.code === 10008) return null
			throw e
		}))
		if (!fetchedNewMessage)
			return console.log(`[DiscordInterface] Updated message ${newMessage.id} not found or deleted, skipping processing.`)

		const fountEntry = await discordMessageToFountChatLogEntry(fetchedNewMessage, interfaceConfig)
		if (fountEntry)
			await processMessageUpdate(fountEntry, discordPlatformAPI, fetchedNewMessage.channel.id)
	})

	client.on(Events.MessageDelete, async (message) => {
		if (!message.id || !message.channelId) {
			console.warn('[DiscordInterface] Received MessageDelete event with missing id or channelId.')
			return
		}
		// 调用核心逻辑处理删除
		await processMessageDelete(message.id, discordPlatformAPI, message.channelId)
	})

	if (interfaceConfig.BotActivityName && interfaceConfig.BotActivityType)
		client.user?.setPresence({
			activities: [{ name: interfaceConfig.BotActivityName, type: ActivityType[interfaceConfig.BotActivityType] }],
			status: 'online',
		})


	if (client.user) {
		const botUserId = client.user.id
		const botDisplayName = client.user.displayName || client.user.globalName || client.user.username || BotFountCharname
		discordUserIdToDisplayName[botUserId] = `${botDisplayName} (咱自己)`
		discordDisplayNameToId[botDisplayName] = botUserId
		discordDisplayNameToId[BotFountCharname] = botUserId
	}

	if (interfaceConfig.OwnerDiscordID) {
		resolvedOwnerId = interfaceConfig.OwnerDiscordID
		try {
			await client.users.fetch(resolvedOwnerId)
		} catch (e) {
			console.error(`[DiscordInterface] Failed to fetch owner user by OwnerDiscordID ${resolvedOwnerId}. Ensure the ID is correct.`, e)
			resolvedOwnerId = null
		}
	} else if (interfaceConfig.OwnerUserName) {
		let found = false
		for (const guild of client.guilds.cache.values())
			try {
				const members = await guild.members.fetch()
				const ownerMember = members.find(m => m.user.username === interfaceConfig.OwnerUserName)
				if (ownerMember) {
					resolvedOwnerId = ownerMember.id
					found = true
					break
				}
			} catch (e) {
				console.warn(`[DiscordInterface] Error fetching members for guild ${guild.name} while resolving OwnerID: ${e.message}. This might be expected for some guilds due to permissions.`)
			}

		if (!found)
			console.warn(`[DiscordInterface] Could not resolve OwnerID for UserName "${interfaceConfig.OwnerUserName}" from shared guilds. Owner-specific features might be limited.`)

	} else
		console.warn('[DiscordInterface] Neither OwnerDiscordID nor OwnerUserName are configured. Owner-specific features will not work.')

	await registerPlatformAPI(discordPlatformAPI)

	return discordPlatformAPI
}
