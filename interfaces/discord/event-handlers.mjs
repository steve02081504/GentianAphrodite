import { Events, ActivityType } from 'npm:discord.js'

import { processIncomingMessage, processMessageUpdate, processMessageDelete } from '../../bot_core/index.mjs'
import { tryFewTimes } from '../../scripts/tryFewTimes.mjs'
import { discordMessageToFountChatLogEntry } from './message-converter.mjs'
import { discordClientInstance, setResolvedOwnerId, discordUserIdToDisplayName, discordDisplayNameToId } from './state.mjs'
import { charname as BotFountCharname } from '../../charbase.mjs'

/**
 * @typedef {import('./config.mjs').DiscordInterfaceConfig_t} DiscordInterfaceConfig_t
 */
/**
 * @typedef {import('../../bot_core/index.mjs').PlatformAPI_t} PlatformAPI_t
 */

/**
 * Discord Bot 的主设置和事件处理函数。
 * @param {DiscordInterfaceConfig_t} interfaceConfig - 传递给此 Discord 接口的特定配置对象。
 * @param {PlatformAPI_t} discordPlatformAPI
 */
export async function registerEventHandlers(interfaceConfig, discordPlatformAPI) {
	const client = discordClientInstance

	client.on(Events.MessageCreate, async (message) => {
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

	let resolvedOwnerId = null
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

	setResolvedOwnerId(resolvedOwnerId)
}
