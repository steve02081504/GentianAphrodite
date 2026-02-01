/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @returns {Promise<single_part_prompt_t>} 醒酒用Prompt
 */
export async function SoberPrompt(args, logical_results) {
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
*龙胆眨了眨水灵灵的眼睛，标志性地眯了下眼。*
`,
		}]
	}
}
