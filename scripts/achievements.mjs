import { unlockAchievement as base } from '../../../../../../src/public/shells/achievements/src/api.mjs'
import { charname, username } from '../charbase.mjs'

/**
 * 为当前角色解锁一项成就。
 * @param {string} id - 要解锁的成就的 ID。
 * @returns {Promise<void>}
 */
export async function unlockAchievement(id) {
	return base(username, 'chars', charname, id)
}
