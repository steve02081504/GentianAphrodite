import { charname as BotCharname, username as FountUsername } from '../charbase.mjs'
import GentianAphrodite from '../main.mjs'
import { localhostLocales } from '../../../../../../src/scripts/i18n.mjs'
import { userIdToNameMap } from './state.mjs'
import { loadDefaultPersona } from '../../../../../../src/server/managers/persona_manager.mjs'
import { fetchFilesForMessages } from './utils.mjs'

/**
 * 平台接口 API 对象类型定义。
 * @typedef {import('./index.mjs').PlatformAPI_t} PlatformAPI_t
 */

/**
 * 扩展的 Fount 聊天日志条目类型，包含平台特定信息。
 * @typedef {import('./state.mjs').chatLogEntry_t_ext} chatLogEntry_t_ext
 */

/**
 * 检查群组中是否存在主人。
 * @async
 * @param {import('./index.mjs').GroupObject} group - 要检查的群组。
 * @param {PlatformAPI_t} platformAPI - 平台 API 实例。
 * @param {string | number | null} ownerOverride - (可选) 测试用的主人用户 ID 覆盖。
 * @returns {Promise<boolean>} 如果主人存在则返回 true，否则返回 false。
 */
async function checkOwnerPresence(group, platformAPI, ownerOverride = null) {
	const ownerIdToCompare = ownerOverride || platformAPI.getOwnerUserId?.()
	const ownerUsernameToCompare = platformAPI.getOwnerUserName?.()

	if (platformAPI.getGroupMembers) {
		const members = await platformAPI.getGroupMembers(group.id)
		if (members)
			return members.some(member =>
				String(member.id) === String(ownerIdToCompare) ||
				(member.username && ownerUsernameToCompare && member.username.toLowerCase() === ownerUsernameToCompare.toLowerCase())
			)

		console.warn(`[BotLogic] Could not retrieve members for group ${group.id} on ${platformAPI.name}. Skipping owner check.`)
	} else
		console.warn(`[BotLogic] getGroupMembers not implemented for platform ${platformAPI.name}. Cannot check owner presence in group ${group.id}. Skipping.`)

	return false // 如果检查失败，默认主人不存在
}

/**
 * 生成 AI 侮辱消息。
 * @async
 * @param {import('./index.mjs').GroupObject} group - 目标群组。
 * @param {PlatformAPI_t} platformAPI - 平台 API 实例。
 * @param {import('./index.mjs').ChannelObject} defaultChannel - 群组的默认频道。
 * @param {chatLogEntry_t_ext[]} channelHistoryForAI - 用于 AI 上下文的频道历史记录。
 * @returns {Promise<string>} AI 生成的侮辱消息内容。
 */
async function generateInsult(group, platformAPI, defaultChannel, channelHistoryForAI) {
	const groupNameForAI = group.name || `Group ${group.id}`
	const insultRequestContext = [
		...channelHistoryForAI,
		{
			name: 'system',
			role: 'system',
			time_stamp: Date.now(),
			content: `
你目前在${groupNameForAI}群组中，但这里没有找到你的主人，显然你是被某个傻逼拉进来的。
现在发挥你的聪明才智随便骂几句，随后你会自动退出群组。
` },
	]

	const fountBotDisplayName = (await GentianAphrodite.getPartInfo?.(localhostLocales[0]))?.name || BotCharname
	const botUserId = platformAPI.getBotUserId?.()
	const botUsername = platformAPI.getBotUsername?.()
	const botDisplayName = platformAPI.getBotDisplayName?.()
	const botNameForAIChat = userIdToNameMap[botUserId] || `${botUsername} (咱自己)` || `${botDisplayName} (咱自己)` || `${fountBotDisplayName} (咱自己)`

	const ownerPlatformUsernameForAI = platformAPI.getOwnerUserName?.()
	const ownerPlatformIdForAI = platformAPI.getOwnerUserId?.()
	const userCharNameForAI = userIdToNameMap[ownerPlatformIdForAI] || ownerPlatformUsernameForAI

	const insultRequest = {
		supported_functions: { markdown: true, files: false, add_message: false, mathjax: false, html: false, unsafe_html: false },
		username: FountUsername,
		chat_name: platformAPI.getChatNameForAI(group.id, { extension: { platform_guild_id: group.id, platform_channel_id: defaultChannel.id, platform: platformAPI.name } }),
		char_id: BotCharname,
		Charname: botNameForAIChat,
		UserCharname: userCharNameForAI,
		ReplyToCharname: '',
		locales: localhostLocales,
		time: new Date(),
		world: platformAPI.getPlatformWorld?.() || null,
		user: loadDefaultPersona(FountUsername),
		char: GentianAphrodite,
		other_chars: [],
		plugins: { ...platformAPI.getPlatformSpecificPlugins?.({ extension: { platform_guild_id: group.id, platform_channel_id: defaultChannel.id, platform: platformAPI.name } }) },
		chat_scoped_char_memory: {},
		chat_log: await fetchFilesForMessages(insultRequestContext),
		extension: { platform: platformAPI.name, chat_id: defaultChannel.id, is_direct_message: false }
	}

	try {
		const aiInsultReply = await GentianAphrodite.interfaces.chat.GetReply(insultRequest)
		if (aiInsultReply && aiInsultReply.content)
			return aiInsultReply.content

		console.warn('[BotLogic] AI did not generate insult content, using default.')
	} catch (e) {
		console.error(`[BotLogic] AI insult generation failed for group ${group.id}:`, e)
	}
	return '？' // 默认侮辱内容
}

/**
 * 向主人发送邀请通知。
 * @async
 * @param {import('./index.mjs').GroupObject} group - 目标群组。
 * @param {PlatformAPI_t} platformAPI - 平台 API。
 * @param {import('./index.mjs').ChannelObject} defaultChannel - 群组的默认频道。
 * @param {string | Error | null} inviteLink - 生成的邀请链接或错误对象。
 */
async function sendOwnerInviteNotifications(group, platformAPI, defaultChannel, inviteLink) {
	if (inviteLink && !(inviteLink instanceof Error)) {
		const inviteMessage = `咱被拉入了一个您不在的群组（已经退啦！）: \`${group.name}\` (ID: \`${group.id}\`)
链接: ${inviteLink}`
		if (platformAPI.sendDirectMessageToOwner)
			await platformAPI.sendDirectMessageToOwner(inviteMessage)
		else
			console.warn(`[BotLogic] sendDirectMessageToOwner not implemented for ${platformAPI.name}.`)


		const ownerPresenceResult = await platformAPI.getOwnerPresenceInGroups?.()
		const ownerUsernameToCompare = platformAPI.getOwnerUserName?.()
		if (ownerPresenceResult?.groupsWithOwner?.length > 0)
			ownerPresenceResult.groupsWithOwner.forEach(async otherGroup => {
				if (otherGroup.id === group.id) return

				const otherGroupDefaultChannel = await platformAPI.getGroupDefaultChannel?.(otherGroup.id)
				if (otherGroupDefaultChannel && platformAPI.sendMessage)
					try {
						await platformAPI.sendMessage(otherGroupDefaultChannel.id, { content: `@${ownerUsernameToCompare} ` + inviteMessage })
					} catch (e) {
						console.error(`[BotLogic] Failed to send invite message to owner in group ${otherGroup.name}:`, e)
					}

			})

	} else
		console.warn(`[BotLogic] Could not generate or use invite link for group ${group.id}. InviteLink:`, inviteLink)

}

/**
 * 发送侮辱消息并离开群组。
 * @async
 * @param {import('./index.mjs').GroupObject} group - 目标群组。
 * @param {PlatformAPI_t} platformAPI - 平台 API。
 * @param {import('./index.mjs').ChannelObject} defaultChannel - 群组的默认频道。
 */
async function sendInsultAndLeaveGroup(group, platformAPI, defaultChannel) {
	let channelHistoryForAI = []
	if (platformAPI.fetchChannelHistory)
		channelHistoryForAI = await platformAPI.fetchChannelHistory(defaultChannel.id, 10)


	const insultMessageContent = await generateInsult(group, platformAPI, defaultChannel, channelHistoryForAI)

	if (platformAPI.sendMessage && insultMessageContent)
		try {
			await platformAPI.sendMessage(defaultChannel.id, { content: insultMessageContent })
		} catch (e) {
			console.error(`[BotLogic] Failed to send insult to group ${group.id}:`, e)
		}


	if (platformAPI.leaveGroup)
		await platformAPI.leaveGroup(group.id)
	else
		console.warn(`[BotLogic] leaveGroup not implemented for ${platformAPI.name}. Cannot leave group ${group.id}.`)

}

/**
 * 处理主人不在群组中的情况。
 * @async
 * @param {import('./index.mjs').GroupObject} group - 目标群组。
 * @param {PlatformAPI_t} platformAPI - 平台 API 实例。
 * @param {import('./index.mjs').ChannelObject} defaultChannel - 群组的默认频道。
 */
async function handleOwnerNotInGroup(group, platformAPI, defaultChannel) {
	console.log(`[BotLogic] Owner NOT found in group ${group.name} (ID: ${group.id}). Taking action...`)

	let inviteLink = null
	if (platformAPI.generateInviteLink)
		inviteLink = await platformAPI.generateInviteLink(group.id, defaultChannel.id)
			.catch(error => {
				console.error(`[BotLogic] Error generating invite link for group ${group.id}:`, error.stack)
				return error
			})
	else
		console.warn(`[BotLogic] generateInviteLink not implemented for ${platformAPI.name}.`)


	await sendOwnerInviteNotifications(group, platformAPI, defaultChannel, inviteLink)
	await sendInsultAndLeaveGroup(group, platformAPI, defaultChannel)
}

/**
 * 检查群组中是否存在主人，并在主人不在时执行相应操作。
 * @param {import('./index.mjs').GroupObject} group - 要检查的群组。
 * @param {PlatformAPI_t} platformAPI - 平台 API 实例。
 * @param {string | number | null} ownerOverride - (可选) 测试用的主人用户 ID 覆盖。
 */
async function handleGroupCheck(group, platformAPI, ownerOverride = null) {
	if (!group || !platformAPI) {
		console.error('[BotLogic] handleGroupCheck: Invalid group or platformAPI provided.')
		return
	}

	try {
		const ownerIsPresent = await checkOwnerPresence(group, platformAPI, ownerOverride)
		if (ownerIsPresent) return

		const defaultChannel = await platformAPI.getGroupDefaultChannel?.(group.id)
		if (!defaultChannel) {
			console.warn(`[BotLogic] Could not find a default channel for group ${group.id}. Cannot send invite or message.`)
			// Still attempt to leave the group even if a default channel isn't found.
			if (platformAPI.leaveGroup)
				await platformAPI.leaveGroup(group.id)
			else
				console.warn(`[BotLogic] leaveGroup not implemented for ${platformAPI.name}. Cannot leave group ${group.id}.`)

			return
		}
		await handleOwnerNotInGroup(group, platformAPI, defaultChannel)
	} catch (error) {
		console.error(`[BotLogic] Error in handleGroupCheck for group ${group.id} on ${platformAPI.name}:`, error)
	}
}

/**
 * 设置群组加入时的处理器。
 * @param {PlatformAPI_t} platformAPI - 平台 API 实例。
 */
function setupOnGroupJoinHandler(platformAPI) {
	if (platformAPI.onGroupJoin)
		platformAPI.onGroupJoin(async (group) => {
			await handleGroupCheck(group, platformAPI)
		})
	else
		console.warn(`[BotLogic] onGroupJoin not implemented for platform: ${platformAPI.name}`)

}

/**
 * 执行初始的群组主人存在性检查。
 * @async
 * @param {PlatformAPI_t} platformAPI - 平台 API 实例。
 */
async function performInitialGroupOwnerCheck(platformAPI) {
	let usedOptimizedCheck = false
	if (platformAPI.getOwnerPresenceInGroups)
		try {
			const presenceResult = await platformAPI.getOwnerPresenceInGroups()
			if (presenceResult) {
				if (presenceResult.groupsWithoutOwner.length > 0)
					for (const group of presenceResult.groupsWithoutOwner) {
						await new Promise(resolve => setTimeout(resolve, 2000)) // 错开检查
						await handleGroupCheck(group, platformAPI)
					}

				usedOptimizedCheck = true
			} else
				console.warn(`[BotLogic] Optimized owner presence check returned null for ${platformAPI.name}. Falling back if alternative is available.`)

		} catch (e) {
			console.error(`[BotLogic] Error calling getOwnerPresenceInGroups for ${platformAPI.name}:`, e)
		}


	if (!usedOptimizedCheck && platformAPI.getJoinedGroups)
		try {
			const allGroups = await platformAPI.getJoinedGroups()
			if (allGroups && allGroups.length > 0)
				for (const group of allGroups) {
					await new Promise(resolve => setTimeout(resolve, 2000)) // 错开检查
					await handleGroupCheck(group, platformAPI)
				}

		} catch (e) {
			console.error(`[BotLogic] Error fetching joined groups for ${platformAPI.name} fallback check:`, e)
		}
	else if (!usedOptimizedCheck)
		console.log(`[BotLogic] No group checking mechanism available for ${platformAPI.name} at startup (Neither getOwnerPresenceInGroups nor getJoinedGroups are fully supported/implemented).`)

}

/**
 * 设置主人离开群组时的处理器。
 * @param {PlatformAPI_t} platformAPI - 平台 API 实例。
 */
function setupOnOwnerLeaveGroupHandler(platformAPI) {
	if (platformAPI.onOwnerLeaveGroup)
		platformAPI.onOwnerLeaveGroup(async (groupId, leftUserId) => {
			const ownerIdForPlatform = platformAPI.getOwnerUserId?.()
			if (ownerIdForPlatform && String(leftUserId) === String(ownerIdForPlatform))
				try {
					await platformAPI.leaveGroup?.(groupId)
				} catch (e) {
					console.error(`[BotLogic] Error leaving group ${groupId} after owner departure on ${platformAPI.name}: `, e)
				}

		})
	else
		console.warn(`[BotLogic] onOwnerLeaveGroup not implemented for platform: ${platformAPI.name}.`)

}

/**
 * 注册平台 API 实例。
 * @param {PlatformAPI_t} platformAPI - 要注册的平台 API 实例。
 */
export async function registerPlatformAPI(platformAPI) {
	if (!platformAPI) {
		console.error('[BotLogic] Attempted to register an invalid platform API.')
		return
	}

	setupOnGroupJoinHandler(platformAPI)
	await performInitialGroupOwnerCheck(platformAPI) // 启动时进行初始检查
	setupOnOwnerLeaveGroupHandler(platformAPI)
}
