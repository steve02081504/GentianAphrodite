import { setCared } from '../../../../../../src/public/parts/shells/chat/src/chat/lib/care.mjs'
import { agentEntityHash } from '../../../../../../src/public/parts/shells/chat/src/chat/lib/entity.mjs'
import { getLocalNodeHash, resolveOperatorEntityHash } from '../../../../../../src/public/parts/shells/chat/src/chat/lib/replica.mjs'
import { base_match_keys } from '../scripts/match.mjs'
import { newUserMessage } from '../scripts/statistics.mjs'

import { handleOwnerCommands } from './commands.mjs'
import {
	deriveOwnerNameKeywords,
	extractMessageText,
	resolveMessageContext,
	waitForOwnerTypingEnd,
} from './helpers.mjs'
import { tryRepeatReply } from './repeat.mjs'
import { shouldTriggerReply } from './scoring.mjs'

const CHARNAME = 'GentianAphrodite'

/** @type {string} */
let selfEntityHash = ''
/** @type {string} */
let operatorEntityHash = ''
/** @type {string[]} */
let ownerNameKeywords = []

/**
 * @param {string} selfHash 自身 entityHash
 * @param {string} operatorHash operator entityHash
 */
export function setTriggerIdentity(selfHash, operatorHash) {
	selfEntityHash = String(selfHash || '').toLowerCase()
	operatorEntityHash = String(operatorHash || '').toLowerCase()
}

/**
 * @param {string[]} keywords 主人昵称关键词
 */
export function setOwnerNameKeywords(keywords) {
	ownerNameKeywords = keywords
}

/**
 * @param {Parameters<NonNullable<import('../../../../../../src/decl/charAPI.ts').CharAPI_t['interfaces']['chat']['onMessage']>>[0]} event onMessage 事件
 * @returns {Promise<boolean>} 是否愿意回复
 */
export async function onMessage(event) {
	if (!selfEntityHash) return false

	const memory = event.chatReplyRequest.chat_scoped_char_memory ??= {}
	const content = extractMessageText(event.message)
	const platform = event.chatReplyRequest.extension?.bridge?.platform || 'chat'
	const channelId = event.channel?.channelId || 'default'
	const { isFromOwner, mentionsBot, mentionsOwner, client, message } =
		await resolveMessageContext(event, selfEntityHash, operatorEntityHash)

	const commandResult = await handleOwnerCommands({
		content,
		memory,
		message,
		client,
		groupId: event.group.groupId,
		channelId,
		isFromOwner,
		platform,
		username: event.chatReplyRequest.username,
	})
	if (commandResult === 'handled' || commandResult === 'exit') return false

	if (await tryRepeatReply({
		event, message, memory, platform, selfHash: selfEntityHash, ownerNameKeywords,
	})) return false

	if (isFromOwner) newUserMessage(content, platform)

	if (base_match_keys(content, [/^龙胆.{0,2}(自裁|复诵).{0,2}/]) && !isFromOwner) return false

	const willTrigger = await shouldTriggerReply({
		event,
		memory,
		isFromOwner,
		mentionsBot,
		mentionsOwner,
		selfHash: selfEntityHash,
		operatorHash: operatorEntityHash,
		content,
		ownerNameKeywords,
	})

	if (willTrigger && isFromOwner) {
		const group = await client.group(event.group.groupId)
		const channel = await group.channel(channelId)
		await waitForOwnerTypingEnd(channel, operatorEntityHash)
	}

	return willTrigger
}

/**
 * @param {string} replicaUsername replica
 */
export async function initTriggerIdentity(replicaUsername) {
	const nodeHash = getLocalNodeHash()
	const selfHash = agentEntityHash(nodeHash, `chars/${CHARNAME}`)
	const operatorHash = (await resolveOperatorEntityHash(replicaUsername))?.toLowerCase()
	setTriggerIdentity(selfHash, operatorHash || '')
	setOwnerNameKeywords(await deriveOwnerNameKeywords(replicaUsername))
	if (operatorHash) await setCared(replicaUsername, selfHash, operatorHash, true)
}

/**
 *
 */
export { selfEntityHash, operatorEntityHash, ownerNameKeywords, CHARNAME }
