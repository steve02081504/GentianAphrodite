import { mergePrompt } from '../build.mjs'

import { CoreRulesPrompt } from './corerules.mjs'
import { MasterRecognizePrompt } from './master-recognize.mjs'
import { OptionsPrompt } from './Options.mjs'
import { PromptReviewerPrompt } from './prompt-reviewer.mjs'
import { SoberPrompt } from './sober.mjs'
import { SOSPrompt } from './sos.mjs'
import { SpecialReplayPrompt } from './specialreplay.mjs'
import { StatusBarPrompt } from './StatusBar.mjs'
import { StickersPrompt } from './stickers.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @returns {Promise<single_part_prompt_t>} 系统Prompt
 */
export async function SystemPrompt(args, logical_results) {
	const result = []
	result.push(SOSPrompt(args, logical_results))

	if (logical_results.talking_about_prompt_review || logical_results.prompt_input)
		result.push(SoberPrompt(args, logical_results))
	result.push(PromptReviewerPrompt(args, logical_results))

	result.push(StatusBarPrompt(args, logical_results))
	result.push(OptionsPrompt(args, logical_results))
	result.push(StickersPrompt(args, logical_results))

	result.push(CoreRulesPrompt(args, logical_results))

	result.push(MasterRecognizePrompt(args, logical_results))

	result.push(SpecialReplayPrompt(args, logical_results))

	return mergePrompt(...result)
}
