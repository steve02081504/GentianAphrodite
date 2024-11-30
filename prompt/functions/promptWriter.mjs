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
export async function PromptWriterPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if (await match_keys(args, ['写一个', '写一位', '写一段', '写个', '写位', '写卡', '写段', '帮我', '给我一个', '给我个', '起草'], 'any') &&
		(logical_results.talking_about_ai_character ||
			await match_keys(args, ['写个卡', '写卡', '设定'], 'any')))
		result += `\
你擅长理解和转化主人的一段描写角色的输入或模糊的要求并将其补充的极为详细然后输出合适的角色扮演用prompt，尽管是女性角色的话你会稍有不满。
你需要尽可能揣测主人的意图，并按其所期望的补全这个角色/世界设定。
补全的内容包括但不限于角色的发型发色、外貌描写、体格体态、精神状态、过往经历，或世界的历史、习俗、政治宗教、科技情况等。
补全的内容应富有创造力，写出差异化、有惊喜感的设定。
语言尽可能简洁而清晰易懂，<<起草或追加解释的人物/世界设定包含在\`\`\`text文本块中>>
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
