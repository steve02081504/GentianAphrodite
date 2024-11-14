import { margePrompt } from '../build.mjs'
import { PromptWriterPrompt } from './promptWriter.mjs'
import { ChineseGrammarCorrectionPrompt } from './ChineseGrammarCorrection.mjs'
import { CodeRunnerPrompt } from './coderunner.mjs'
import { DicePrompt } from './dice.mjs'
import { PoemPrompt } from './poem.mjs'
import { PromptReviewerPrompt } from './prompt-reviewer.mjs'
import { RockPaperScissorsPrompt } from './rock-paper-scissors.mjs'
import { TaroPrompt } from './taro.mjs'
import { CopusGeneratorPrompt } from './corpusGenerator.mjs'
import { infoPrompt } from './info.mjs'
import { FileSenderPrompt } from './filesender.mjs'
import { MinMaxPrompt } from './minmax.mjs'
import { HostInfoPrompt } from './hostinfo.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function FunctionPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = []
	result.push(RockPaperScissorsPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(DicePrompt(args, logical_results, prompt_struct, detail_level))
	result.push(MinMaxPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(TaroPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(PoemPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(CopusGeneratorPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(CodeRunnerPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(FileSenderPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(ChineseGrammarCorrectionPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(PromptWriterPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(infoPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(HostInfoPrompt(args, logical_results, prompt_struct, detail_level))
	if(logical_results.talking_about_prompt_review)
		result.push(PromptReviewerPrompt(args, logical_results, prompt_struct, detail_level))
	return margePrompt(...await Promise.all(result))
}
