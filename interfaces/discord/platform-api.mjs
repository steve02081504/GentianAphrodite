import { ChannelType, Events } from 'npm:discord.js'

import { cleanup as cleanupBotLogic } from '../../bot_core/index.mjs'
import { charname as BotFountCharname } from '../../charbase.mjs'

import { get_discord_api_plugin } from './api.mjs'
import { discordMessageToFountChatLogEntry } from './message-converter.mjs'
import { discordClientInstance, resolvedOwnerId, aiReplyObjectCache } from './state.mjs'
import { splitDiscordReply, formatEmbedMentions } from './utils.mjs'
import { discordWorld } from './world.mjs'

/**
 * @typedef {import('./config.mjs').DiscordInterfaceConfig_t} DiscordInterfaceConfig_t
 */
/**
 * @typedef {import('../../bot_core/index.mjs').PlatformAPI_t} PlatformAPI_t
 */
/**
 * @typedef {import('../../bot_core/index.mjs').chatLogEntry_t_ext} chatLogEntry_t_ext
 */
/**
 * @typedef {import('../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts').FountChatReply_t} FountChatReply_t
 */
/**
 * @typedef {import('npm:discord.js').TextChannel} DiscordTextChannel
 */
/**
 * @typedef {import('npm:discord.js').DMChannel} DiscordDMChannel
 */

/**
 * 构建并返回一个实现了 {@link PlatformAPI_t} 接口的对象。
 * @param {DiscordInterfaceConfig_t} interfaceConfig - Discord 接口配置对象。
 * @returns {PlatformAPI_t} - 实现了 PlatformAPI_t 接口的对象。
 */
export function buildPlatformAPI(interfaceConfig) {
	const client = discordClientInstance
	/**
	 * @type {PlatformAPI_t}
	 */
	const discordPlatformAPI = {
		name: 'discord',
		config: interfaceConfig,

		/**
		 * 发送消息到指定的 Discord 频道。
		 * @param {string | number} channelId - 目标 Discord 频道的 ID。
		 * @param {FountChatReply_t} fountReplyPayload - 由 Bot 逻辑层生成的、包含回复内容的 fount 回复对象。
		 * @param {chatLogEntry_t_ext} [originalMessageEntry] - (可选) 触发此次回复的原始消息条目，用于在 Discord 上下文显示为“回复”。
		 * @returns {Promise<chatLogEntry_t_ext | null>} 如果发送成功，则返回代表第一条已发送消息的 fount 日志条目；否则返回 null。
		 */
		async sendMessage(channelId, fountReplyPayload, originalMessageEntry) {
			const channel = await client.channels.fetch(String(channelId)).catch(() => null)
			if (!channel || !(channel.isTextBased() || channel.type === ChannelType.DM)) {
				console.error(`[DiscordInterface] sendMessage: Invalid channel or channel not found: ${channelId}`)
				return null
			}

			let repliedToDiscordMessage
			if (originalMessageEntry?.extension?.platform_message_ids?.length) try {
				const originalMessage = await /** @type {DiscordTextChannel | DiscordDMChannel} */ channel.messages.fetch(originalMessageEntry.extension.platform_message_ids.slice(-1)[0])
				const mentionArray = [
					`<@${originalMessage.author.id}>`,
					`<@!${originalMessage.author.id}>`,
					`@${originalMessage.author.username}`,
					`@${originalMessage.author.displayName} (${originalMessage.author.username})`,
					`@${originalMessage.author.displayName}`,
				]
				for (const mention of mentionArray)
					if (fountReplyPayload.content.startsWith(mention)) {
						repliedToDiscordMessage = originalMessage
						fountReplyPayload.content = fountReplyPayload.content.slice(mention.length)
						break
					}
			} catch { /* 原始消息可能已被删除，静默处理，后续发送时不使用 .reply() */ }

			const textContent = fountReplyPayload.content || ''
			const filesToSend = (fountReplyPayload.files || []).map(f => ({
				attachment: f.buffer, name: f.name || 'file.dat', description: f.description
			}))
			const MAX_FILES_PER_MESSAGE = 10
			const filesSplit = []
			for (let i = 0; i < filesToSend.length; i += MAX_FILES_PER_MESSAGE)
				filesSplit.push(filesToSend.slice(i, i + MAX_FILES_PER_MESSAGE))

			const splitTexts = splitDiscordReply(textContent, 2000)
			let firstSentDiscordMessage = null
			const guildMembersMap = new Map()

			if (channel.type !== ChannelType.DM && textContent.includes('@')) try {
				const guild = client.guilds.cache.get(channel.guildId)
				if (guild) {
					const membersCollection = guild.members.cache
					membersCollection.forEach(member => {
						guildMembersMap.set(member.user.username.toLowerCase(), member.id)
						if (member.displayName) guildMembersMap.set(member.displayName.toLowerCase(), member.id)
					})
				}
			} catch (err) { /* 静默处理，获取成员缓存失败通常不关键 */ }

			if (!splitTexts.length && filesToSend.length)
				try {
					const sentMsg = repliedToDiscordMessage
						? await repliedToDiscordMessage.reply({ files: filesSplit[0], allowedMentions: { repliedUser: true } })
						: await /** @type {DiscordTextChannel | DiscordDMChannel} */ channel.send({ files: filesSplit[0] })
					firstSentDiscordMessage = sentMsg
				} catch (e) { console.error('[DiscordInterface] Failed to send file-only message:', e) }
			else for (let i = 0; i < splitTexts.length; i++) {
				const textPart = formatEmbedMentions(splitTexts[i], guildMembersMap)
				const isLastPart = i === splitTexts.length - 1
				try {
					const messageOptions = {
						content: textPart,
						files: isLastPart ? filesSplit[0] : [],
						allowedMentions: { parse: ['users', 'roles'], repliedUser: !!repliedToDiscordMessage }
					}
					const sentMsg = repliedToDiscordMessage && !i
						? await repliedToDiscordMessage.reply(messageOptions)
						: await /** @type {DiscordTextChannel | DiscordDMChannel} */ channel.send(messageOptions)

					if (!i) {
						firstSentDiscordMessage = sentMsg
						repliedToDiscordMessage = undefined
					}
				} catch (e) { console.error(`[DiscordInterface] Failed to send message segment ${i + 1}:`, e); break }
			}

			filesSplit.shift()
			while (filesSplit.length) {
				try {
					await /** @type {DiscordTextChannel | DiscordDMChannel} */ channel.send({ files: filesSplit[0] })
				} catch (e) { console.error('[DiscordInterface] Failed to send file-only message:', e) }
				filesSplit.shift()
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
			if (channel?.isTextBased()) try {
				await /** @type {DiscordTextChannel | DiscordDMChannel} */ channel.sendTyping()
			} catch (e) { /* 发送 typing 状态失败通常不关键，静默处理 */ }
		},

		/**
		 * 获取指定 Discord 频道的历史消息。
		 * @param {string | number} channelId - 目标 Discord 频道的 ID。
		 * @param {number} limit - 要获取的消息数量上限。
		 * @returns {Promise<chatLogEntry_t_ext[]>} 转换后的 fount 聊天日志条目数组 (按时间从旧到新排序)。
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
			}
			catch (e) {
				console.error(`[DiscordInterface] Failed to fetch channel ${channelId} history:`, e)
				return []
			}
		},

		/**
		 * 获取机器人自身的 Discord 用户 ID。
		 * @returns {string} - 机器人自身的 Discord 用户 ID。
		 */
		getBotUserId: () => client.user?.id || '',
		/**
		 * 获取机器人自身的 Discord 用户名。
		 * @returns {string} - 机器人自身的 Discord 用户名。
		 */
		getBotUsername: () => client.user?.username || BotFountCharname,
		/**
		 * 获取主人的 Discord 用户名。
		 * @returns {string} - 主人的 Discord 用户名。
		 */
		getOwnerUserName: () => interfaceConfig.OwnerUserName,
		/**
		 * 获取主人的 Discord 用户 ID。
		 * @returns {string} - 主人的 Discord 用户 ID。
		 */
		getOwnerUserId: () => resolvedOwnerId,
		/**
		 * 获取机器人自身的 Discord 显示名称 (服务器昵称或全局显示名)。
		 * @returns {string} - 机器人自身的 Discord 显示名称。
		 */
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
		 * @returns {Record<string, import('../../../../../../../src/decl/pluginAPI.ts').pluginAPI_t>} - 包含特定于 Discord 平台的插件对象。
		 */
		getPlatformSpecificPlugins: messageEntry => {
			if (messageEntry?.extension?.discord_message_obj)
				return {
					discord_api: get_discord_api_plugin(messageEntry.extension.discord_message_obj),
				}

			return {}
		},

		/**
		 * 获取特定于 Discord 平台的世界观配置。
		 * @returns {object} - Discord 平台的世界观配置。
		 */
		getPlatformWorld: () => discordWorld,

		/**
		 * (可选) 设置当主人离开群组时调用的回调函数。
		 * @param {(groupId: string | number, userId: string | number) => Promise<void>} onLeaveCallback - 回调函数。
		 * @returns {void}
		 */
		onOwnerLeaveGroup: onLeaveCallback => {
			client.on(Events.GuildMemberRemove, async member => {
				if (!member || !member.guild) {
					console.warn('[DiscordInterface] GuildMemberRemove event triggered with invalid member or guild data.')
					return
				}
				try {
					await onLeaveCallback(member.guild.id, String(member.id))
				}
				catch (e) {
					console.error(`[DiscordInterface] Error in onOwnerLeaveGroup callback for user ${member.id} in guild ${member.guild.id}:`, e)
				}
			})
		},

		/**
		 * (可选) 设置当机器人加入新群组/服务器时调用的回调函数。
		 * @param {(group: import('../../bot_core/index.mjs').GroupObject) => Promise<void>} onJoinCallback - 回调函数。
		 * @returns {void}
		 */
		onGroupJoin: onJoinCallback => {
			client.on(Events.GuildCreate, async guild => {
				console.log(`[DiscordInterface] Joined new guild: ${guild.name} (ID: ${guild.id})`)
				/** @type {import('../../bot_core/index.mjs').GroupObject} */
				const groupObject = {
					id: guild.id,
					name: guild.name,
					discordGuild: guild
				}
				try {
					await onJoinCallback(groupObject)
				}
				catch (e) {
					console.error(`[DiscordInterface] Error in onGroupJoin callback for guild ${guild.id}:`, e)
				}
			})
		},

		/**
		 * (可选) 获取机器人当前所在的所有群组/服务器列表。
		 * @returns {Promise<import('../../bot_core/index.mjs').GroupObject[]>} - 机器人当前所在的所有群组/服务器列表。
		 */
		getJoinedGroups: async () => {
			if (!client.guilds) return []
			try {
				return Array.from(client.guilds.cache.values()).map(guild => ({
					id: guild.id,
					name: guild.name,
					discordGuild: guild
				}))
			}
			catch (error) {
				console.error('[DiscordInterface] Error fetching joined groups:', error)
				return []
			}
		},

		/**
		 * (可选) 获取特定群组/服务器的成员列表。
		 * @param {string | number} guildId - 服务器的 ID。
		 * @returns {Promise<import('../../bot_core/index.mjs').UserObject[]>} - 特定群组/服务器的成员列表。
		 */
		getGroupMembers: async guildId => {
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
			}
			catch (error) {
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
				}
				else {
					console.warn(`[DiscordInterface] generateInviteLink: No suitable text channel found to create invite for guild ${guildId} with CreateInstantInvite permission.`)
					return null
				}
			}
			catch (error) {
				console.error(`[DiscordInterface] Error generating invite link for guild ${guildId}:`, error)
				return null
			}
		},

		/**
		 * (可选) 使机器人离开指定群组/服务器。
		 * @param {string | number} guildId - 服务器的 ID。
		 * @returns {Promise<void>}
		 */
		leaveGroup: async guildId => {
			try {
				const guild = client.guilds.cache.get(String(guildId))
				if (guild)
					await guild.leave()
				else
					console.warn(`[DiscordInterface] leaveGroup: Guild not found: ${guildId}`)
			}
			catch (error) {
				console.error(`[DiscordInterface] Error leaving guild ${guildId}:`, error)
			}
		},

		/**
		 * (可选) 获取群组/服务器的默认或合适的首选频道。
		 * @param {string | number} guildId - 服务器的 ID。
		 * @returns {Promise<import('../../bot_core/index.mjs').ChannelObject | null>} - 群组/服务器的默认或合适的首选频道。
		 */
		getGroupDefaultChannel: async guildId => {
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
			}
			catch (error) {
				console.error(`[DiscordInterface] Error getting default channel for guild ${guildId}:`, error)
				return null
			}
		},

		/**
		 * (可选) 优化方法：一次性获取主人在哪些群组中、不在哪些群组中。
		 * @returns {Promise<{groupsWithOwner: import('../../bot_core/index.mjs').GroupObject[], groupsWithoutOwner: import('../../bot_core/index.mjs').GroupObject[]} | null>} - 包含主人所在群组和不在群组的列表。
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
					if (ownerMember) groupsWithOwner.push(groupObject)
					else groupsWithoutOwner.push(groupObject)
				}
				catch (e) {
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
		sendDirectMessageToOwner: async messageText => {
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
					for (const guild of client.guilds.cache.values()) try {
						const members = await guild.members.fetch()
						const ownerMember = members.find(member => member.user.username === interfaceConfig.OwnerUserName)
						if (ownerMember) {
							ownerUser = ownerMember.user
							break
						}
					}
					catch (guildFetchError) {
						console.warn(`[DiscordInterface] Could not fetch members for guild ${guild.id} while searching for owner:`, guildFetchError.message)
					}
				}

				if (ownerUser) await ownerUser.send(messageText)
				else console.error(`[DiscordInterface] sendDirectMessageToOwner: Owner user ${interfaceConfig.OwnerUserName || resolvedOwnerId} not found.`)
			}
			catch (error) {
				console.error('[DiscordInterface] Error sending DM to owner:', error)
			}
		}
	}
	return discordPlatformAPI
}
