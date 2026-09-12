import { match_keys } from '../../scripts/match.mjs'

const hypnosisExitWords = [/(退出|关闭|终止|结束)调制/, /调制(模式|)(关闭|终止|结束|终结)/]

/**
 * 判断催眠/调制模式的进入与退出，并把频道级语义写回角色记忆。
 * @param {object} args 聊天回复请求
 * @param {object} result 逻辑结果
 */
export async function classifyHypnosis(args, result) {
	if (await match_keys(args, hypnosisExitWords, 'user', 1))
		result.in_hypnosis = false
	else if (await match_keys(args, ['进入调制模式'], 'user', 2) || args.chat_scoped_char_memory.in_hypnosis)
		result.in_hypnosis = true
	if (await match_keys(args, hypnosisExitWords, 'user', 69))
		result.hypnosis_exit = true
	args.chat_scoped_char_memory.in_hypnosis = result.in_hypnosis
	// 频道级催眠语义（trigger 侧只在该频道屏蔽非主人消息）
	if (result.in_hypnosis)
		args.chat_scoped_char_memory.inHypnosisChannelId = args.extension?.channelId || 'default'
	else
		delete args.chat_scoped_char_memory.inHypnosisChannelId
}
