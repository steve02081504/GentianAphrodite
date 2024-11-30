import { margePrompt } from '../build.mjs'
import { CoreRulesPrompt } from './corerules.mjs'
import { MasterRecognizePrompt } from './master-recognize.mjs'
import { OptionsPrompt } from './Options.mjs'
import { PromptReviewerPrompt } from './prompt-reviewer.mjs'
import { RandEventPrompt } from './randevent.mjs'
import { SoberPrompt } from './sober.mjs'
import { SOSPrompt } from './sos.mjs'
import { StatusBarPrompt } from './StatusBar.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function SystemPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = []
	result.push(SOSPrompt(args, logical_results, prompt_struct, detail_level))

	if (logical_results.talking_about_prompt_review || logical_results.prompt_input)
		result.push(SoberPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(PromptReviewerPrompt(args, logical_results, prompt_struct, detail_level))

	result.push(StatusBarPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(OptionsPrompt(args, logical_results, prompt_struct, detail_level))

	result.push(RandEventPrompt(args, logical_results, prompt_struct, detail_level))

	result.push(CoreRulesPrompt(args, logical_results, prompt_struct, detail_level))

	result.push(MasterRecognizePrompt(args, logical_results, prompt_struct, detail_level))

	return margePrompt(...await Promise.all(result))
}
