import { getChatClient } from '../../../../../../src/public/parts/shells/chat/src/api/client/index.mjs'
import { lookupBridgeEntityReverse } from '../../../../../../src/public/parts/shells/chat/src/chat/bridge/identity.mjs'
import { messageMentionsEntity } from '../../../../../../src/public/parts/shells/chat/src/chat/lib/mentionFacts.mjs'
import { resolveOperatorEntityHash } from '../../../../../../src/public/parts/shells/chat/src/chat/lib/replica.mjs'
import { resolveDeclaredOwnerEntityHash, resolveTrustedOwnerContext } from '../../../../../../src/public/parts/shells/chat/src/entity/master.mjs'
import { getUserByUsername } from '../../../../../../src/server/auth/index.mjs'
import { loadAnyPreferredDefaultPart } from '../../../../../../src/server/parts_loader.mjs'
import { base_match_keys, base_match_keys_count } from '../scripts/match.mjs'
import { sleep } from '../scripts/tools.mjs'

import { GentianWords, MuteDurationMs } from './constants.mjs'

/**
 * @param {object} message 消息行
 * @returns {string} 纯文本内容
 */
export function extractMessageText(message) {
	const raw = message?.content
	if (typeof raw === 'string') return raw.trim()
	if (raw?.type === 'text' && raw.content != null) return String(raw.content).trim()
	if (raw && typeof raw === 'object' && raw.content != null) return String(raw.content).trim()
	return String(raw ?? '').trim()
}

/**
 * @param {object} event OnMessage 事件
 * @param {string} selfHash 自身 hash
 * @param {string} [_legacyOperatorHash] 兼容旧调用；主人以 identity.ownerEntityHash 为准
 * @returns {Promise<{ authorHash: string, isFromOwner: boolean, attribution: object, mentionsBot: boolean, mentionsOwner: boolean, client: object, message: object, declaredOwnerEntityHash: string | null }>} 消息上下文
 */
export async function resolveMessageContext(event, selfHash, _legacyOperatorHash) {
	const username = event.chatReplyRequest.username
	const client = await getChatClient(username, selfHash)
	const message = await client.messageFrom(event)
	const author = await message.author()
	const result = await resolveTrustedOwnerContext({
		username,
		agentEntityHash: selfHash,
		eventOrLine: event,
		authorEntityHash: author?.entityHash || null,
	})
	const declaredOwner = result.declaredOwnerEntityHash
		|| await resolveDeclaredOwnerEntityHash(username, selfHash)
	const mentionsBot = await messageMentionsEntity(event, selfHash)
	const mentionsOwner = declaredOwner ? await messageMentionsEntity(event, declaredOwner) : false
	return {
		authorHash: result.authorEntityHash || String(author?.entityHash || '').toLowerCase(),
		isFromOwner: result.isFromOwner,
		attribution: result.attribution,
		mentionsBot,
		mentionsOwner,
		client,
		message,
		declaredOwnerEntityHash: declaredOwner,
	}
}

/**
 * @param {string} replicaUsername replica
 * @param {string} [agentEntityHash] agent hash；用于读声明主人昵称
 * @returns {Promise<string[]>} 主人称呼关键词
 */
export async function deriveOwnerNameKeywords(replicaUsername, agentEntityHash = '') {
	/** @type {Set} */
	const keywords = new Set()
	if (replicaUsername) keywords.add(replicaUsername)
	const user = getUserByUsername(replicaUsername)
	if (user?.username) keywords.add(user.username)
	try {
		const persona = await loadAnyPreferredDefaultPart(replicaUsername, 'personas')
		for (const row of Object.values(persona?.info || {}))
			if (row?.name) keywords.add(String(row.name))
	} catch { /* no persona */ }
	try {
		const ownerHash = agentEntityHash
			? await resolveDeclaredOwnerEntityHash(replicaUsername, agentEntityHash)
			: await resolveOperatorEntityHash(replicaUsername)
		const displayName = ownerHash && lookupBridgeEntityReverse(replicaUsername, ownerHash)?.displayName
		if (displayName) keywords.add(displayName)
	} catch { /* no bridge identity */ }
	const filtered = [...keywords].filter(word => word && word.length >= 2)
	return filtered.length ? filtered : [...keywords].filter(Boolean)
}

/**
 * @param {string} content 消息正文
 * @param {{ hasOtherGentianBot?: boolean }} [env={}] 环境标志
 * @returns {boolean} 是否叫名（无 @）
 */
export function detectMentionedWithoutAt(content, env = {}) {
	const text = String(content || '').trim()
	const firstFiveChars = text.substring(0, 5)
	const lastFiveChars = text.substring(text.length - 5)
	const contentEdgesForChineseCheck = firstFiveChars + ' ' + lastFiveChars

	const engWords = text.split(' ')
	const leadingEngWords = engWords.slice(0, 6).join(' ')
	const trailingEngWords = engWords.slice(-3).join(' ')
	const contentEdgesForEnglishCheck = leadingEngWords + ' ' + trailingEngWords

	const isChineseNamePattern = base_match_keys(contentEdgesForChineseCheck, [
		'龙胆', /(?<![乌大巨火肝苦]|big)[胆龙][ 亲儿子宝，]/,
	])
	const isEnglishNamePattern = base_match_keys(contentEdgesForEnglishCheck, ['gentian'])
	const isBotNamePatternDetected = isChineseNamePattern || isEnglishNamePattern

	const isPossessiveOrStatePhrase = base_match_keys(text, [
		/(龙胆(有(?!没有)|能|这边|目前|[^ 。你，]{0,3}的)|(gentian('s|is|are|can|has)))/i,
	])
	const isNameAtEndOfShortPhrase = base_match_keys(text, [/^.{0,4}龙胆$/i])

	return !env.hasOtherGentianBot
		&& isBotNamePatternDetected
		&& !isPossessiveOrStatePhrase
		&& !isNameAtEndOfShortPhrase
}

/**
 * @param {object[]} chatLog 聊天记录
 * @param {string} selfHash 自身 hash
 * @returns {boolean} 群内是否有另一只龙胆
 */
export function detectOtherGentianBot(chatLog, selfHash) {
	const recent = (chatLog || []).filter(row => {
		const ts = new Date(row.time_stamp || 0).getTime()
		return Date.now() - ts < 5 * 60 * 1000
	})
	const text = recent
		.filter(row => rowAuthorHashFromLog(row) !== selfHash && !row.charId && row.content?.role !== 'char')
		.map(row => extractMessageText(row))
		.join('\n')
	return !!(base_match_keys_count(text, GentianWords) && base_match_keys_count(text, ['主人', 'master']) > 1)
}

/**
 * @param {object} row chat_log 行
 * @returns {string} 作者 entityHash（小写）
 */
function rowAuthorHashFromLog(row) {
	return String(row.extension?.bridge?.authorEntityHash || row.extension?.authorEntityHash || row.sender || '').toLowerCase()
}

/**
 * @param {object} memory chat_scoped_char_memory
 * @param {string} groupId 群 ID
 * @returns {boolean} 是否处于静音期
 */
export function isGroupMuted(memory, groupId) {
	const until = memory.muteUntil?.[groupId]
	return typeof until === 'number' && until > Date.now()
}

/**
 * @param {object} memory chat_scoped_char_memory
 * @param {string} groupId 群 ID
 */
export function clearGroupMute(memory, groupId) {
	if (memory.muteUntil?.[groupId]) delete memory.muteUntil[groupId]
}

/**
 * @param {object} memory chat_scoped_char_memory
 * @param {string} groupId 群 ID
 */
export function muteGroup(memory, groupId) {
	memory.muteUntil ??= {}
	memory.muteUntil[groupId] = Date.now() + MuteDurationMs
}

/**
 * @param {object} channel Channel 鸭子类型
 * @param {string} ownerHash 声明主人 entityHash
 * @param {number} [quietMs=3000] 连续静默窗口
 * @returns {Promise<void>}
 */
export async function waitForOwnerTypingEnd(channel, ownerHash, quietMs = 3000) {
	const op = String(ownerHash || '').toLowerCase()
	if (!op) return
	let quietSince = null
	while (true) {
		const typing = await channel.typingUsers()
		const ownerTyping = typing.some(hash => String(hash).toLowerCase() === op)
		if (ownerTyping) {
			quietSince = null
			await sleep(200)
			continue
		}
		if (quietSince == null) quietSince = Date.now()
		if (Date.now() - quietSince >= quietMs) return
		await sleep(200)
	}
}

/**
 * @param {object[]} chatLog 聊天记录
 * @param {string} selfHash 自身 hash
 * @returns {number} 最后 bot 消息时间戳
 */
export function lastBotMessageTimestamp(chatLog, selfHash) {
	const row = [...chatLog || []].reverse().find(entry =>
		entry.charId || entry.content?.role === 'char' || rowAuthorHashFromLog(entry) === selfHash)
	return row ? new Date(row.time_stamp || 0).getTime() : 0
}

/**
 * @param {object[]} chatLog 聊天记录
 * @param {string} selfHash 自身 hash
 * @returns {number} 自上次 bot 发言后的消息条数
 */
export function messagesSinceLastBotReply(chatLog, selfHash) {
	const log = chatLog || []
	const lastBotIndex = log.findLastIndex(entry =>
		entry.charId || entry.content?.role === 'char' || rowAuthorHashFromLog(entry) === selfHash)
	return lastBotIndex === -1 ? log.length : log.slice(lastBotIndex + 1).length
}
