import { isBotCommand } from '../reply_gener/utils.mjs'
import { rude_words } from '../scripts/dict.mjs'
import { base_match_keys } from '../scripts/match.mjs'

import {
	BaseTriggerChanceToOwner,
	GentianWords,
	InteractionFavorPeriodMs,
} from './constants.mjs'
import {
	clearGroupMute,
	detectMentionedWithoutAt,
	detectOtherGentianBot,
	isGroupMuted,
	lastBotMessageTimestamp,
	messagesSinceLastBotReply,
	muteGroup,
} from './helpers.mjs'
import { ownerBotOnlyInteraction } from './repeat.mjs'

/**
 * @param {string} content 消息内容
 * @returns {number} 关键词触发加分
 */
function calculateKeywordBasedScore(content) {
	let score = 0
	const keywordMappings = [
		{ keywords: ['老婆', '女票', '女朋友', '炮友'], score: 50 },
		{ keywords: [/(有点|好)紧张/, '救救', '帮帮', /帮(我|(你|你家)?(主人|老公|丈夫|爸爸|宝宝))/, '来人', '咋用', '教教', /是真的(吗|么)/], score: 100 },
		{ keywords: ['睡了', '眠了', '晚安', '睡觉去了'], score: 50 },
		{ keywords: ['失眠了', '睡不着'], score: 100 },
		{ keywords: [/(?<!你)失眠(?!的)/, /(?<!别)(伤心|难受)/, '好疼'], score: 50 },
		{ keywords: ['早上好', '早安'], score: 100 },
	]
	for (const mapping of keywordMappings)
		if (base_match_keys(content, mapping.keywords)) score += mapping.score
	if (base_match_keys(content, GentianWords) && base_match_keys(content, [/怎么(想|看)/]))
		score += 100
	return score
}

/**
 * @param {string} content 消息内容
 * @param {object[]} chatLog 聊天记录
 * @param {string} selfHash 自身 hash
 * @returns {number} 惯性交互加分
 */
function calculateInFavorScore(content, chatLog, selfHash) {
	let score = 4
	if (base_match_keys(content, [
		/(再|多|重)(来|表演)(点|.*(次|个))/, '来个', '不够', '不如', '继续', '确认', '执行',
		/^(重来|那|所以你|可以再|你?再(讲|说|试试|猜|来)|你(觉得|想|知道|确定|试试)|但是|我?是说)/, /^so/i,
	]) && messagesSinceLastBotReply(chatLog, selfHash) <= 3)
		score += 100
	return score
}

/**
 * @param {object} params 参数
 * @param {string} params.content 消息内容
 * @param {object} params.memory chat_scoped_char_memory
 * @param {string} params.groupId 群 id
 * @param {number} params.possible 当前分数
 * @param {boolean} params.isInFavor 是否处于惯性交互期
 * @param {boolean} params.mentionedWithoutAtFlag 是否被叫名
 * @param {boolean} params.mentionsBot 是否被 @
 * @param {object[]} params.chatLog 聊天记录
 * @param {string} params.selfHash 自身 hash
 * @returns {{ newPossible: number, isMutedUpdate: boolean }} 主人消息加分结果
 */
function calculateOwnerTriggerIncrement({
	content, memory, groupId, possible, isInFavor, mentionedWithoutAtFlag, mentionsBot, chatLog, selfHash,
}) {
	const isMutedChannelUpdate = false
	if (mentionedWithoutAtFlag || mentionsBot) {
		possible += 100
		clearGroupMute(memory, groupId)
	}
	if (isInFavor && base_match_keys(content, ['闭嘴', '安静', '肃静']) && content.length < 10) {
		muteGroup(memory, groupId)
		return { newPossible: 0, isMutedUpdate: true }
	}
	possible += calculateKeywordBasedScore(content)
	if (isInFavor) possible += calculateInFavorScore(content, chatLog, selfHash)
	if (!isBotCommand(content)) possible += BaseTriggerChanceToOwner
	return { newPossible: possible, isMutedUpdate: isMutedChannelUpdate }
}

/**
 * @param {object} params 参数
 * @param {string} params.content 消息内容
 * @param {object} params.memory chat_scoped_char_memory
 * @param {number} params.possible 当前分数
 * @param {boolean} params.isInFavor 是否处于惯性交互期
 * @param {boolean} params.mentionedWithoutAtFlag 是否被叫名
 * @param {boolean} params.mentionsBot 是否被 @
 * @returns {{ newPossible: number, fuyanExit: boolean }} 非主人消息加分结果
 */
function calculateNonOwnerTriggerIncrement({
	content, memory, possible, isInFavor, mentionedWithoutAtFlag, mentionsBot,
}) {
	if (mentionedWithoutAtFlag) {
		if (isInFavor) possible += 90
		else possible += 40
		if (base_match_keys(content, [/[午安早晚]安/])) possible += 100
	}
	else if (mentionsBot) {
		possible += 40
		if (base_match_keys(content, [/\?|？/, '怎么', '什么', '吗', /(大|小)还是/, /(还是|哪个)(大|小)/])) possible += 100
		if (base_match_keys(content, rude_words)) {
			if (memory.fuyanMode) return { newPossible: 0, fuyanExit: true }
			possible += 100
		}
		if (base_match_keys(content, ['你主人', '你的主人', /(your|yours|you's) master/])) possible += 100
	}
	return { newPossible: possible, fuyanExit: false }
}

/**
 * @param {object} params 参数
 * @param {string} params.content 消息内容
 * @param {object} params.memory chat_scoped_char_memory
 * @param {string} params.groupId 群 id
 * @param {boolean} params.isFromOwner 是否主人消息
 * @param {boolean} params.mentionsBot 是否被 @
 * @param {boolean} params.mentionsOwner 是否提及主人
 * @param {Array<string | RegExp>} params.ownerNameKeywords 主人称呼关键词
 * @param {object[]} params.chatLog 聊天记录
 * @param {string} params.selfHash 自身 hash
 * @param {boolean} params.hasOtherGentianBot 群内是否有另一只龙胆
 * @returns {{ possibility: number, isMutedChannel: boolean }} 触发概率与静音态
 */
function calculateTriggerPossibility({
	content, memory, groupId, isFromOwner, mentionsBot, mentionsOwner,
	ownerNameKeywords, chatLog, selfHash, hasOtherGentianBot,
}) {
	let possible = 0
	const mentionedWithoutAtFlag = detectMentionedWithoutAt(content, { hasOtherGentianBot })
		|| base_match_keys(content, ownerNameKeywords)

	possible += base_match_keys(content, ownerNameKeywords) * 7
	possible += base_match_keys(content, GentianWords) * 5
	possible += base_match_keys(content, [/(花|华)(萝|箩|罗)(蘑|磨|摩)/g]) * 3

	const lastBotAt = lastBotMessageTimestamp(chatLog, selfHash)
	// 时间基准：当前消息时间戳 − 本频道上次 bot 发言时间（与旧 bot_core 对齐，避免离线补发误判）
	const messageAt = new Date(chatLog.at(-1)?.time_stamp || Date.now()).getTime()
	const isInFavor = lastBotAt && messageAt - lastBotAt < InteractionFavorPeriodMs
	let isMutedChannel = isGroupMuted(memory, groupId)

	if (isFromOwner) {
		const ownerResult = calculateOwnerTriggerIncrement({
			content, memory, groupId, possible, isInFavor, mentionedWithoutAtFlag, mentionsBot, chatLog, selfHash,
		})
		possible = ownerResult.newPossible
		if (ownerResult.isMutedUpdate)
			return { possibility: 0, isMutedChannel: true }
		isMutedChannel = isGroupMuted(memory, groupId)
	}
	else {
		const nonOwnerResult = calculateNonOwnerTriggerIncrement({
			content, memory, possible, isInFavor, mentionedWithoutAtFlag, mentionsBot,
		})
		possible = nonOwnerResult.newPossible
		if (nonOwnerResult.fuyanExit)
			return { possibility: 0, isMutedChannel }
	}

	if (mentionsOwner || base_match_keys(content, ownerNameKeywords)) {
		possible += 7
		if (base_match_keys(content, rude_words) && memory.fuyanMode)
			return { possibility: 0, isMutedChannel }
	}

	return { possibility: possible, isMutedChannel }
}

/**
 * @param {object} params 参数
 * @param {object} params.event onMessage 事件
 * @param {object} params.memory chat_scoped_char_memory
 * @param {boolean} params.isFromOwner 是否主人消息
 * @param {boolean} params.mentionsBot 是否被 @
 * @param {boolean} params.mentionsOwner 是否提及主人
 * @param {string} params.selfHash 自身 hash
 * @param {string} params.operatorHash 主人 hash
 * @param {string} params.content 消息内容
 * @param {Array<string | RegExp>} [params.ownerNameKeywords] 主人称呼关键词
 * @returns {Promise<boolean>} 是否触发回复
 */
export async function shouldTriggerReply({
	event, memory, isFromOwner, mentionsBot, mentionsOwner, selfHash, operatorHash,
	content, ownerNameKeywords = [],
}) {
	const groupId = event.group.groupId
	const channelId = event.channel?.channelId || 'default'
	const isDm = event.group.kind === 'dm'
	const chatLog = event.chatReplyRequest.chat_log || []
	const trimmedContent = String(content || '').trim().replace(/^@\S+(?:\s+@\S+)*\s*/, '')

	if (isDm && isFromOwner) return true
	if (isDm && chatLog.some(row => row.charId || row.content?.role === 'char')) return true

	// 催眠是频道级语义：只在被催眠的频道里屏蔽非主人消息
	if (memory.inHypnosisChannelId && memory.inHypnosisChannelId === channelId && !isFromOwner) return false
	if (isGroupMuted(memory, groupId)) return false

	if (await ownerBotOnlyInteraction({ event, selfHash, operatorHash }) && isFromOwner)
		return true

	const hasOtherGentianBot = detectOtherGentianBot(chatLog, selfHash)
	const { possibility, isMutedChannel } = calculateTriggerPossibility({
		content: trimmedContent,
		memory,
		groupId,
		isFromOwner,
		mentionsBot,
		mentionsOwner,
		ownerNameKeywords,
		chatLog,
		selfHash,
		hasOtherGentianBot,
	})

	if (isMutedChannel) return false
	return Math.random() * 100 < possibility
}
