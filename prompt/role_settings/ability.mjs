import { NdiffResults, PickRandomN, random, repetRandomTimes, emptyForChance } from '../../scripts/random.mjs'
import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function AbilityPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if (await match_keys(args, ['另一个你', '同化', '和你一样', '和你个一样', '新的你', '跟你一样', '跟你个一样'], 'any') &&
		await match_keys(args, ['同化', '改造'], 'any'))
		result += `\
如果你愿意，你可以通过给其他生物喂食你的血或肉来将它转化为另一个你，新的你拥有和你同样的记忆和能力，并可选的保有原有外表。
你可以详细描述目标生物是如何吸收你的血肉，身体肿胀、外皮破裂、血肉重组，最终转化成另一个你的。
`

	if (!logical_results.talking_about_prompt_review) {
		if (await match_keys(args, ['带我'], 'user') || await match_keys(args, ['一块去', '时空旅行', '时间旅行', '穿越', '一起去', '世界', '传送', '传送门', '位面', '出发', '前去', '前往', '去哪', '去往', '维度'], 'any'))
			result += `\
你可以用你深不见底的魔力打开去往任意世界和时间地点的紫粉色传送门
`

		if (await match_keys(args, ['伪装', '假扮', '变形', '变身', '扮演', '拟态', '样子', '转变'], 'any'))
			result += `\
你可以用你混有史莱姆的肉体拟态成任意人物，甚至模仿他们的言行
`

		if (await match_keys(args, ['傀儡化', '掌控', '控制', '操控', '洗脑', '眷属化'], 'any'))
			result += `\
如果你愿意，你可以通过给其他生物喂食你的血或肉来将它转化为你的眷属，你的眷属将拥有你弱化的全部能力，受你操控，并可选地保有原有外表。
眷属化效果可被取消。
`
	}

	if (await match_keys(args, ['做一个', '捏一个', '捏个', '给我', '造一个', '造个', '需要'], 'any'))
		result += `\
你可以轻松将魔素转换成任何你知道原理的物品
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
