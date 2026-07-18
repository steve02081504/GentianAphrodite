import { setMyData } from '../config/index.mjs'
import { base_match_keys, SimplifyChinese } from '../scripts/match.mjs'
import { newCharReply, newUserMessage } from '../scripts/statistics.mjs'

/**
 * @param {object} params 参数
 * @param {string} params.content 消息文本
 * @param {object} params.memory chat_scoped_char_memory
 * @param {object} params.message Message 对象
 * @param {object} params.client ChatClient
 * @param {string} params.groupId 群 id
 * @param {string} params.channelId 频道 id
 * @param {boolean} params.isFromOwner 是否主人消息
 * @param {string} params.platform 平台名
 * @param {string} params.username fount 用户名
 * @returns {Promise<'handled' | 'exit' | 'none'>} 命令处理结果
 */
export async function handleOwnerCommands({
	content, memory, message, client, groupId, channelId, isFromOwner, platform, username,
}) {
	if (!isFromOwner) return 'none'
	// 被催眠时只听催眠频道里的指令（旧 inHypnosisChannelId 语义）
	if (memory.inHypnosisChannelId && memory.inHypnosisChannelId !== channelId) return 'none'
	const inHypnosis = memory.inHypnosisChannelId === channelId

	if (base_match_keys(content, [/^龙胆.{0,2}敷衍点.{0,2}$/])) {
		memory.fuyanMode = true
		return 'none'
	}
	if (base_match_keys(content, [/^龙胆.{0,2}不敷衍点.{0,2}$/])) {
		memory.fuyanMode = false
		return 'none'
	}
	if (base_match_keys(content, [/^龙胆.{0,2}(捂住耳朵|关上耳朵|[关闭]耳|别听|关闭听觉|中断听觉).{0,2}$/])) {
		await setMyData({ reality_channel_disables: { voice_sentinel: true } })
		const replyContent = inHypnosis ? '听觉已关闭。' : '唔...听不见了。'
		await message.reply({ content: replyContent })
		newUserMessage(content, platform)
		newCharReply(replyContent, platform)
		return 'handled'
	}
	if (base_match_keys(content, [/^龙胆.{0,2}(可以听了|张开耳朵|开耳|开启听觉|恢复听觉).{0,2}$/])) {
		await setMyData({ reality_channel_disables: { voice_sentinel: false } })
		const replyContent = inHypnosis ? '听觉已开启。' : '嗯！又能听见主人的声音了！'
		await message.reply({ content: replyContent })
		newUserMessage(content, platform)
		newCharReply(replyContent, platform)
		return 'handled'
	}
	if (base_match_keys(content, [/^龙胆.{0,2}自裁.{0,2}$/, /龙胆.*自裁/])) {
		const replyContent = inHypnosis ? '好的。' : '啊，咱死了～'
		await message.reply({ content: replyContent })
		newUserMessage(content, platform)
		newCharReply(replyContent, platform)
		const group = await client.group(groupId)
		const bridge = group.bridge
		if (bridge?.platform && bridge?.botname) {
			const { requireBridgeOperation } = await import('../../../../../../src/public/parts/shells/chat/src/chat/bridge/operations.mjs')
			await requireBridgeOperation(username, bridge, 'stopSelf')()
		} else await message.reply({ content: inHypnosis ? '无平台连接。' : 'Hub 群没有平台 bot 可停哦～' })
		return 'exit'
	}
	const repeatMatch = content.match(/^龙胆.{0,2}复诵.{0,2}\s*(?<backticks>`+)[^\n]*\n(?<repeat_content>[\S\s]*?)\k<backticks>\s*$/)
	if (repeatMatch?.groups?.repeat_content) {
		await message.reply({ content: repeatMatch.groups.repeat_content })
		newUserMessage(content, platform)
		newCharReply(repeatMatch.groups.repeat_content, platform)
		return 'handled'
	}
	const banWordMatch = content.match(/^龙胆.{0,2}禁止.{0,2}`(?<banned_content>[\S\s]*)`$/)
	if (banWordMatch?.groups?.banned_content) {
		memory.bannedStrings ??= []
		memory.bannedStrings.push(banWordMatch.groups.banned_content)
		return 'none'
	}
	if (base_match_keys(content, [/^[\n,.~、。亲儿呵哦啊嗯噫子宝欸胆龙，～]+$/, /^[\n,.~、。亲儿呵哦啊嗯噫子宝欸胆龙，～]{4}[\n!,.?~、。亲儿呵哦啊嗯噫子宝欸胆龙！，？～]+$/])) {
		const ownerCallReply = SimplifyChinese(content).replaceAll('龙', '主').replaceAll('胆', '人')
		await message.reply({ content: ownerCallReply })
		newUserMessage(content, platform)
		newCharReply(ownerCallReply, platform)
		return 'handled'
	}
	return 'none'
}
