import { Events, ActivityType } from 'npm:discord.js'

import { processIncomingMessage, processMessageUpdate, processMessageDelete, preloadChannel } from '../../bot_core/index.mjs'
import { updateOwnerTypingStartTime } from '../../bot_core/state.mjs'
import { charname as BotFountCharname } from '../../charbase.mjs'
import { tryFewTimes } from '../../scripts/tryFewTimes.mjs'

import { discordMessageToFountChatLogEntry } from './message-converter.mjs'
import { discordClientInstance, setResolvedOwnerId, resolvedOwnerId, discordUserIdToDisplayName, discordDisplayNameToId } from './state.mjs'

/**
 * @typedef {import('./config.mjs').DiscordInterfaceConfig_t} DiscordInterfaceConfig_t
 */
/**
 * @typedef {import('../../bot_core/index.mjs').PlatformAPI_t} PlatformAPI_t
 */

/**
 * 注册 Discord 客户端的主要事件处理器。
 * 此函数负责设置机器人如何响应消息创建、更新和删除事件，
 * 同时也会设置机器人的活动状态（如果已配置），并解析和设置所有者用户的 ID。
 * @param {DiscordInterfaceConfig_t} interfaceConfig - 此 Discord 接口的特定配置对象。
 * @param {PlatformAPI_t} discordPlatformAPI - 用于将 Discord 事件传递到机器人核心逻辑的平台 API。
 */
export async function registerEventHandlers(interfaceConfig, discordPlatformAPI) {
	const client = discordClientInstance

	client.on(Events.MessageCreate, async message => {
		if (message.author.username === client.user.username) return
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

	client.on(Events.TypingStart, async typing => {
		if (!resolvedOwnerId) return
		if (typing.user.id === resolvedOwnerId) {
			updateOwnerTypingStartTime(typing.channel.id)
			preloadChannel(typing.channel.id, discordPlatformAPI)
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

	client.on(Events.MessageDelete, async message => {
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

	let localResolvedOwnerId = null
	if (interfaceConfig.OwnerDiscordID) {
		localResolvedOwnerId = interfaceConfig.OwnerDiscordID
		try {
			await client.users.fetch(localResolvedOwnerId)
		}
		catch (e) {
			console.error(`[DiscordInterface] Failed to fetch owner user by OwnerDiscordID ${localResolvedOwnerId}. Ensure the ID is correct.`, e)
			localResolvedOwnerId = null
		}
	}
	else if (interfaceConfig.OwnerUserName) {
		let found = false
		for (const guild of client.guilds.cache.values())
			try {
				const members = await guild.members.fetch()
				const ownerMember = members.find(m => m.user.username === interfaceConfig.OwnerUserName)
				if (ownerMember) {
					localResolvedOwnerId = ownerMember.id
					found = true
					break
				}
			}
			catch (e) {
				console.warn(`[DiscordInterface] Error fetching members for guild ${guild.name} while resolving OwnerID: ${e.message}. This might be expected for some guilds due to permissions.`)
			}

		if (!found) console.warn(`[DiscordInterface] Could not resolve OwnerID for UserName "${interfaceConfig.OwnerUserName}" from shared guilds. Owner-specific features might be limited.`)
	}
	else console.warn('[DiscordInterface] Neither OwnerDiscordID nor OwnerUserName are configured. Owner-specific features will not work.')

	setResolvedOwnerId(localResolvedOwnerId)
}
