import { match_keys } from '../../scripts/match.mjs'

/**
 * 判断对话是否进入战斗描写。
 * @param {object} args 聊天回复请求
 * @param {object} result 逻辑结果
 */
export async function classifyFight(args, result) {
	if (!result.talking_about_prompt_review &&
		await match_keys(args, ['冲刺', '击打', '刀', '刺出', '剑', '命绝', '战士', '战斗', '作战', '打击', '打斗', '抵挡', '挥舞', '攻击', '杀意', '枪', '格挡', '武器', '潜行', '炮', '猛击', '盔甲', '绝命', '遇袭', '重击', '铠甲', '锤击', '防具', '防御'], 'any') >= 2)
		result.in_fight = true
}
