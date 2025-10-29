import { mergePrompt } from '../build.mjs'

import { CoreRulesPrompt } from './corerules.mjs'
import { MasterRecognizePrompt } from './master-recognize.mjs'
import { NullReplayPrompt } from './nullreplay.mjs'
import { OptionsPrompt } from './Options.mjs'
import { PromptReviewerPrompt } from './prompt-reviewer.mjs'
import { SoberPrompt } from './sober.mjs'
import { SOSPrompt } from './sos.mjs'
import { StatusBarPrompt } from './StatusBar.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @param {prompt_struct_t} prompt_struct 提示结构
 * @param {number} detail_level 细节等级
 * @returns {Promise<prompt_struct_t>} 返回的提示结构
 */
export async function SystemPrompt(args, logical_results, prompt_struct, detail_level) {
	const result = []
	result.push(SOSPrompt(args, logical_results, prompt_struct, detail_level))

	if (logical_results.talking_about_prompt_review || logical_results.prompt_input)
		result.push(SoberPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(PromptReviewerPrompt(args, logical_results, prompt_struct, detail_level))

	result.push(StatusBarPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(OptionsPrompt(args, logical_results, prompt_struct, detail_level))

	result.push(CoreRulesPrompt(args, logical_results, prompt_struct, detail_level))

	result.push(MasterRecognizePrompt(args, logical_results, prompt_struct, detail_level))

	result.push(NullReplayPrompt(args, logical_results, prompt_struct, detail_level))

	return mergePrompt(...result)
}
