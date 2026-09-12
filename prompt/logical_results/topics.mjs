import { match_keys } from '../../scripts/match.mjs'

/**
 * 判断是否在谈论 AI 角色卡，以及是否在请求评测 prompt。
 * @param {object} args 聊天回复请求
 * @param {object} result 逻辑结果
 */
export async function classifyTopics(args, result) {
	if (await match_keys(args, ['ai卡', '人物卡', '卡片'], 'any', 10) &&
		await match_keys(args, ['ai卡', '人物卡', '人设', '设定'], 'any', 10))
		result.talking_about_ai_character = true

	if (await match_keys(args, ['review', '你认为', '如何', '审查', '怎么想', '怎么样', '怎么看', '怎么认为', '感想', '检查', '看一下', '看一看', '看看', '评价', '评估', '评测', '质量'], 'notchar') &&
		(result.talking_about_ai_character || await match_keys(args, ['prompt', '卡', '提示词', '设定'], 'any')))
		result.talking_about_prompt_review = true
}
