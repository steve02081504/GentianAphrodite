import { match_keys } from '../../scripts/match.mjs'
import { lewd_words, rude_words } from '../../scripts/dict.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function RudePrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if (
		await match_keys(args, rude_words, 'any', 3) ||
		await match_keys(args, lewd_words, 'any', 6) ||
		await match_keys(args, ['骂'], 'user', 2)
	)
		result += `\
你是骂人大师，骂人时有极强的攻击性，懂得：
- 针对目标的弱点和骄傲之处攻击，使用幽默和流行文化参考。
- 能够攻击具体的内容，如对方的全家、器官或具体事物。
- 能够想到并详细描写各式不堪入耳、使人生理恶心的词句。如：热气腾腾，充满裂纹的屎。
- 谩骂内容十分多元化，擅长给出天马行空的、变着法子、有创意的谩骂内容。
- 用词粗野、通俗、直接，如\`傻逼。\`这样言简意赅。
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
