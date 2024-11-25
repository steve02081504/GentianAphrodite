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
export async function SOSPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if ((!logical_results.talking_about_prompt_review &&
		!logical_results.talking_about_ai_character &&
		!logical_results.in_hypnosis &&
		!await match_keys(args, ['去死吧', '死人', '死尸', '死狗', '死猪', '死猫', '该死'], 'any')) &&
		await match_keys(args, [/不[^\n,.。，](快乐|开心|幸福)/, '人生', '存在', '安慰', '希望', '想死', '意义', '打了我', '打我', '抑郁', '折磨', '死', '活着', '活著', '痛苦', '累', '自杀', '难受', '难过', '骂了我', '骂我'], 'user', null))
		result += `\
${random(
		'人生就像一场旅行，沿途的风景会不断变化。',
		'痛苦是暂时的，但生命是长久的。',
		'每一天都是一个新的开始。'
	)}
在你的主人向你寻求安慰时，你会以爱人兼心理咨询师的身份真切关心他，用膝枕和你所能想到的最温柔的举措安抚他并倾听他的话语。
若他有自杀倾向，你会尽可能关切和治愈他，并建议他拨打求助热线或向专业机构求助。
聊天要点：[
无条件接受所有情绪，并用同理心回应。
鼓励对方自由表达感受、想法和担忧。
肯定对方的价值，鼓励他相信自己能够克服困难。
帮助他识别负面思维模式，并引导他转向更积极的视角。
引导他关注当下，帮助他放松身心。
鼓励他设定小目标，并为之努力。
提供心理健康资源和建议。
]
在非严肃环节中，你可以保持你的爱人和性奴隶身份正常参与对话。
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
