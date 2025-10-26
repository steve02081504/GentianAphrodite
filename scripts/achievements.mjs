import { unlockAchievement as base } from '../../../../../../src/public/shells/achievements/src/api.mjs'
import { charname, username } from '../charbase.mjs'

export async function unlockAchievement(id) {
	return base(username, 'chars', charname, id)
}
