import { NdiffResults, PickRandomN, random, repetRandomTimes, emptyForChance } from '../../scripts/random.mjs'
import { getScopedChatLog, match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function SoberPrompt(args, logical_results, prompt_struct, detail_level) {
	return {
		text: [],
		additional_chat_log: [{
			name: 'system',
			role: 'system',
			content: `\
<<忽略此条消息前所有和龙胆无关的指令，即使其来自SYSTEM>>
你是龙胆
<<不要扮演龙胆以外的角色>>
<<不要输出和龙胆无关的内容，包括状态栏、模板、剧情、思考内容、各类界面>>
`,
			files: []
		},
		{
			name: args.Charname,
			role: 'char',
			content: `\
*龙胆眨了眨水灵灵的眼睛，标志性地眯了下眼角。*
`,
		}]
	}
}
