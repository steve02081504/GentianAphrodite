import { setCared } from '../../../../../../src/public/parts/shells/chat/src/chat/lib/care.mjs'
import { resolveOperatorEntityHash } from '../../../../../../src/public/parts/shells/chat/src/chat/lib/replica.mjs'
import { ensureLocalAgentEntityHash } from '../../../../../../src/public/parts/shells/chat/src/entity/member.mjs'
import { resolveDeclaredOwnerEntityHash } from '../../../../../../src/public/parts/shells/chat/src/entity/master.mjs'
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
/** @type {string} */
let declaredOwnerEntityHash = ''
/** @type {string[]} */
let ownerNameKeywords = []

/**
 * @param {string} selfHash 自身 entityHash
 * @param {string} operatorHash operator entityHash
 * @param {string} [ownerHash] 声明主人
 */
export function setTriggerIdentity(selfHash, operatorHash, ownerHash = '') {
	selfEntityHash = String(selfHash || '').toLowerCase()
	operatorEntityHash = String(operatorHash || '').toLowerCase()
	declaredOwnerEntityHash = String(ownerHash || operatorHash || '').toLowerCase()
}

/**
 * @param {string[]} keywords 主人昵称关键词
 */
export function setOwnerNameKeywords(keywords) {
	ownerNameKeywords = keywords
}

/**
 * @param {Parameters<NonNullable<import('../../../../../../src/decl/charAPI.ts').CharAPI_t['interfaces']['chat']['OnMessage']>>[0]} event OnMessage 事件
 * @returns {Promise<boolean>} 是否愿意回复
 */
export async function OnMessage(event) {
	if (!selfEntityHash) return false

	const memory = event.chatReplyRequest.chat_scoped_char_memory ??= {}
	const content = extractMessageText(event.message)
	const platform = event.chatReplyRequest.extension?.chat?.bridge?.platform || 'chat'
	const channelId = event.channel?.channelId || 'default'
	const { isFromOwner, mentionsBot, mentionsOwner, client, message, declaredOwnerEntityHash: ownerHash } =
		await resolveMessageContext(event, selfEntityHash, declaredOwnerEntityHash)
	const ownerForTyping = ownerHash || declaredOwnerEntityHash || operatorEntityHash

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
		operatorHash: ownerForTyping,
		content,
		ownerNameKeywords,
	})

	if (willTrigger && isFromOwner) {
		const group = await client.group(event.group.groupId)
		const channel = await group.channel(channelId)
		await waitForOwnerTypingEnd(channel, ownerForTyping)
	}

	return willTrigger
}

/**
 * @param {string} replicaUsername replica
 */
export async function initTriggerIdentity(replicaUsername) {
	const selfHash = await ensureLocalAgentEntityHash(replicaUsername, CHARNAME)
	const operatorHash = (await resolveOperatorEntityHash(replicaUsername))?.toLowerCase()
	const ownerHash = (await resolveDeclaredOwnerEntityHash(replicaUsername, selfHash))?.toLowerCase()
		|| operatorHash
		|| ''
	setTriggerIdentity(selfHash, operatorHash || '', ownerHash)
	setOwnerNameKeywords(await deriveOwnerNameKeywords(replicaUsername, selfHash))
	if (ownerHash) await setCared(replicaUsername, selfHash, ownerHash, true)
}

/**
 *
 */
export { selfEntityHash, operatorEntityHash, declaredOwnerEntityHash, ownerNameKeywords, CHARNAME }
