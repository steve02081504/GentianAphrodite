import { unlockAchievement } from '../../scripts/achievements.mjs'

/**
 * 根据逻辑结果解锁成就。
 * @param {object} args 聊天回复请求
 * @param {object} result 逻辑结果
 */
export function grantLogicalAchievements(args, result) {
	if (result.in_nsfw && (!result.in_multi_char_chat || args.extension?.in_reply_to_master)) unlockAchievement('talk_nsfw_with_master')
	if (result.in_hypnosis) unlockAchievement('enter_hypnosis_mode')
}
