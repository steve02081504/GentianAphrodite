import { is_PureChinese } from '../../scripts/lang-detect.mjs'
import { getScopedChatLog } from '../../scripts/match.mjs'

/**
 * 判断对话是否纯中文。
 * @param {object} args 聊天回复请求
 * @param {object} result 逻辑结果
 */
export async function classifyLanguage(args, result) {
	if (is_PureChinese(getScopedChatLog(args, 'any', 2).map(x => x.content).join('\n')))
		result.is_pure_chinese = true
}
