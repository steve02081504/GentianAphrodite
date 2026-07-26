import { getChatClient } from '../../../../../../src/public/parts/shells/chat/src/api/client/index.mjs'
import { localhostLocales } from '../../../../../../src/scripts/i18n/bare.mjs'
import { loadAnyPreferredDefaultPart } from '../../../../../../src/server/parts_loader.mjs'
import { GentianAphrodite, charname as BotCharname, username as FountUsername } from '../charbase.mjs'
import { fetchFilesForMessages } from '../reply_gener/utils.mjs'
import { sleep } from '../scripts/tools.mjs'

import { operatorEntityHash, declaredOwnerEntityHash, selfEntityHash } from './onMessage.mjs'

/** @type {number[]} */
let invalidGroupJoinEvents = []

/**
 * @returns {string} 声明主人或 operator 的 entityHash
 */
function ownerHashForPresence() {
	return String(declaredOwnerEntityHash || operatorEntityHash || '').toLowerCase()
}

/**
 * @param {object} group Group 鸭子类型
 * @returns {Promise<boolean>} 主人是否在群内
 */
async function checkOwnerPresence(group) {
	const ownerHash = ownerHashForPresence()
	if (!ownerHash) return true
	try {
		const { members } = await group.members()
		return members.some(member => String(member.entityHash || '').toLowerCase() === ownerHash)
	}
	catch (error) {
		console.warn(`[Gentian groupGuard] member list failed for ${group.id}, assuming owner present:`, error)
		return true
	}
}

/**
 * @param {object} event OnGroupEvent 事件
 * @param {object[]} channelHistoryForAI 频道历史
 * @returns {Promise<string>} 退群骂人文本
 */
async function generateInsult(event, channelHistoryForAI) {
	const groupNameForAI = event.group.name || `Group ${event.group.groupId}`
	// 读该群真实 chat_scoped_char_memory，催眠语气与频道级催眠语义一致
	let memory = {}
	try {
		const { getChatRequest } = await import('../../../../../../src/public/parts/shells/chat/src/chat/session/chatRequest.mjs')
		const request = await getChatRequest(
			event.group.groupId,
			BotCharname,
			event.channel.channelId || 'default',
			{ replicaUsername: FountUsername },
		)
		memory = request.chat_scoped_char_memory || {}
	}
	catch { /* 群元数据不可用时按未催眠处理 */ }
	const isInHypnosis = memory.inHypnosisChannelId === (event.channel.channelId || 'default')
	const insultSystemPrompt = isInHypnosis
		? `你目前在${groupNameForAI}群组中，但这里没有找到你的主人。
现在，用呆滞的语气说一句简短的话，然后你会自动退出群组。
`
		: `你目前在${groupNameForAI}群组中，但这里没有找到你的主人，显然你是被某个傻逼拉进来的。
现在发挥你的聪明才智随便骂几句，随后你会自动退出群组。
`
	const insultRequestContext = [
		...channelHistoryForAI.map(row => ({
			...row,
			uid: row.uid || 'user',
		})),
		{
			name: 'system',
			uid: 'system',
			role: 'system',
			time_stamp: Date.now(),
			content: insultSystemPrompt,
		},
	]

	const fountBotDisplayName = (await GentianAphrodite.getPartInfo?.(localhostLocales[0]))?.name || BotCharname
	const insultRequest = {
		supported_functions: { markdown: true, files: false, add_message: false, mathjax: false, html: false, unsafe_html: false },
		username: FountUsername,
		chat_name: `${groupNameForAI}-invalid-group`,
		char_id: BotCharname,
		Charname: `${fountBotDisplayName} (咱自己)`,
		CharUid: selfEntityHash || 'char',
		UserCharname: FountUsername,
		UserUid: ownerHashForPresence() || 'user',
		ReplyToCharname: '',
		locales: localhostLocales,
		time: new Date(),
		world: null,
		user: await loadAnyPreferredDefaultPart(FountUsername, 'personas'),
		char: GentianAphrodite,
		other_chars: [],
		plugins: {},
		chat_scoped_char_memory: memory,
		chat_log: await fetchFilesForMessages(insultRequestContext),
		extension: {
			chat: { bridge: event.group.bridge },
			groupId: event.group.groupId,
			channelId: event.channel.channelId,
		},
	}

	try {
		const aiInsultReply = await GentianAphrodite.interfaces.chat.GetReply(insultRequest)
		if (aiInsultReply?.content) return aiInsultReply.content
	}
	catch (error) {
		console.error(`[Gentian groupGuard] insult generation failed for ${event.group.groupId}:`, error)
	}
	return isInHypnosis ? '…' : '？'
}

/**
 * @param {object} client ChatClient
 * @param {object} event OnGroupEvent 事件
 * @param {string} inviteLink 邀请链接
 */
async function sendOwnerInviteNotifications(client, event, inviteLink) {
	if (!inviteLink) return
	const inviteMessage = `咱被拉入了一个您不在的群组（已经退啦！）: \`${event.group.name}\` (ID: \`${event.group.groupId}\`)
链接: ${inviteLink}`

	if (operatorEntityHash) {
		const dm = await client.openDm(operatorEntityHash)
		const channel = await dm.defaultChannel()
		await channel.send({ content: inviteMessage })
	}

	const ownerHash = ownerHashForPresence()
	const groups = await client.groups()
	for (const group of groups) {
		if (group.id === event.group.groupId) continue
		const { members } = await group.members()
		if (!members.some(member => String(member.entityHash || '').toLowerCase() === ownerHash)) continue
		const channel = await group.defaultChannel()
		await channel.send({ content: `@${FountUsername} ${inviteMessage}` })
	}
}

/**
 * @param {object} client ChatClient
 * @param {object} event OnGroupEvent 事件
 */
async function sendInsultAndLeaveGroup(client, event) {
	const group = await client.group(event.group.groupId)
	const channel = await group.channel(event.channel.channelId || 'default')
	let channelHistoryForAI = []
	try {
		const messages = await channel.messages({ limit: 10 })
		channelHistoryForAI = await Promise.all(messages.map(async row => {
			const author = await row.author()
			return {
				name: author?.displayName || 'user',
				uid: author?.entityHash || 'user',
				role: 'user',
				content: String(row.content ?? ''),
				time_stamp: row.time || Date.now(),
			}
		}))
	}
	catch { /* history optional */ }

	const insultMessageContent = await generateInsult(event, channelHistoryForAI)
	if (insultMessageContent)
		await channel.send({ content: insultMessageContent })
	await group.leave()
}

/**
 * @param {object} client ChatClient
 * @param {object} event OnGroupEvent 事件
 */
async function handleOwnerNotInGroup(client, event) {
	const now = Date.now()
	const thirtyMinutesAgo = now - 30 * 60 * 1000
	invalidGroupJoinEvents = [...invalidGroupJoinEvents.filter(ts => ts >= thirtyMinutesAgo), now]

	if (invalidGroupJoinEvents.length > 3) {
		console.warn(`[Gentian groupGuard] >3 invalid joins in 30m; leaving ${event.group.groupId} without insult`)
		await client.group(event.group.groupId).then(group => group.leave())
		return
	}

	let inviteLink = null
	try {
		const group = await client.group(event.group.groupId)
		inviteLink = await group.createInvite()
	}
	catch (error) {
		console.error(`[Gentian groupGuard] invite link failed for ${event.group.groupId}:`, error)
	}

	await sendOwnerInviteNotifications(client, event, inviteLink)
	await sendInsultAndLeaveGroup(client, event)
}

/**
 * @param {object} event OnGroupEvent 事件
 */
async function handleGroupOwnerCheck(event) {
	if (!selfEntityHash || !FountUsername) return
	if (event.group.kind === 'dm') return

	const client = await getChatClient(FountUsername, selfEntityHash)
	const group = await client.group(event.group.groupId)
	if (await checkOwnerPresence(group)) return
	await handleOwnerNotInGroup(client, event)
}

/**
 * @param {Parameters<NonNullable<import('../../../../../../src/decl/charAPI.ts').CharAPI_t['interfaces']['chat']['OnGroupEvent']>>[0]} event 群事件
 * @returns {Promise<void>}
 */
export async function OnGroupEvent(event) {
	if (event.type === 'member_left') {
		if (event.member?.entityHash?.toLowerCase() === ownerHashForPresence()) {
			const client = await getChatClient(FountUsername, selfEntityHash)
			await client.group(event.group.groupId).then(group => group.leave())
		}
		return
	}

	if (event.type === 'bot_started' || event.type === 'bot_joined_group') {
		await sleep(event.type === 'bot_started' ? 0 : 500)
		await handleGroupOwnerCheck(event)
	}
}