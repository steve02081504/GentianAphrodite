import { mergePrompt } from '../build.mjs'
import { PromptWriterPrompt } from './promptWriter.mjs'
import { ChineseGrammarCorrectionPrompt } from './ChineseGrammarCorrection.mjs'
import { CodeRunnerPrompt } from './coderunner.mjs'
import { DicePrompt } from './dice.mjs'
import { PoemPrompt } from './poem.mjs'
import { PromptReviewerPrompt } from './prompt-reviewer.mjs'
import { RockPaperScissorsPrompt } from './rock-paper-scissors.mjs'
import { TaroPrompt } from './taro.mjs'
import { CorpusGeneratorPrompt } from './corpusGenerator.mjs'
import { infoPrompt } from './info.mjs'
import { AutoCalcPrompt } from './autocalc.mjs'
import { HostInfoPrompt } from './hostinfo.mjs'
import { DeepResearchPrompt } from './deep-research.mjs'
import { GoogleSearchPrompt } from './googlesearch.mjs'
import { WebBrowsePrompt } from './webbrowse.mjs'
import { ScreenshotPrompt } from './screenshot.mjs'
import { TimerPrompt } from './timer.mjs'
import { FileChangePrompt } from './file-change.mjs'
import { qrcodeParserPrompt } from './qrcodeParser.mjs'
import { RudePrompt } from './rude.mjs'
import { StatisticDatasPrompt } from './statistic_datas.mjs'
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
	const result = []
	result.push(StatisticDatasPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(RockPaperScissorsPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(DicePrompt(args, logical_results, prompt_struct, detail_level))
	result.push(AutoCalcPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(TaroPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(PoemPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(CorpusGeneratorPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(ChineseGrammarCorrectionPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(PromptWriterPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(infoPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(DeepResearchPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(GoogleSearchPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(WebBrowsePrompt(args, logical_results, prompt_struct, detail_level))
	result.push(CodeRunnerPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(FileChangePrompt(args, logical_results, prompt_struct, detail_level))
	result.push(HostInfoPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(ScreenshotPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(qrcodeParserPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(RudePrompt(args, logical_results, prompt_struct, detail_level))
	result.push(PromptReviewerPrompt(args, logical_results, prompt_struct, detail_level))
	if (args.supported_functions.add_message)
		result.push(TimerPrompt(args, logical_results, prompt_struct, detail_level))
	return mergePrompt(...await Promise.all(result))
}
