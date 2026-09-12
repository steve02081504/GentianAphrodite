import { mergePrompt } from '../merge.mjs'

import { AutoCalcPrompt } from './auto-calc.mjs'
import { BrowserIntegrationPrompt } from './browser-integration.mjs'
import { CameraPrompt } from './camera.mjs'
import { CharGeneratorPrompt } from './char-generator.mjs'
import { ChineseGrammarCorrectionPrompt } from './chinese-grammar-correction.mjs'
import { CodeRunnerPrompt } from './code-runner.mjs'
import { CorpusGeneratorPrompt } from './corpus-generator.mjs'
import { DeepResearchPrompt } from './deep-research.mjs'
import { DicePrompt } from './dice.mjs'
import { FileChangePrompt } from './file-change.mjs'
import { HostInfoPrompt } from './host-info.mjs'
import { IdleManagementPrompt } from './idle-management.mjs'
import { InfoPrompt } from './info.mjs'
import { KanjiPrompt } from './kanji.mjs'
import { NotifyPrompt } from './notify.mjs'
import { NumberAlchemistPrompt } from './number-alchemist.mjs'
import { PoemPrompt } from './poem.mjs'
import { PromptReviewerPrompt } from './prompt-reviewer.mjs'
import { PromptWriterPrompt } from './prompt-writer.mjs'
import { QrcodeParserPrompt } from './qrcode-parser.mjs'
import { RockPaperScissorsPrompt } from './rock-paper-scissors.mjs'
import { RudePrompt } from './rude.mjs'
import { ScreenshotPrompt } from './screenshot.mjs'
import { StatisticDatasPrompt } from './statistic-datas.mjs'
import { TaroPrompt } from './taro.mjs'
import { TimerPrompt } from './timer.mjs'
import { WebBrowsePrompt } from './web-browse.mjs'
import { WebSearchPrompt } from './web-search.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * 生成功能相关的 Prompt。
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑结果。
 * @returns {Promise<object>} - 合并后的 Prompt 对象。
 */
export async function FunctionPrompt(args, logical_results) {
	const result = []
	result.push(DeepResearchPrompt(args, logical_results))
	result.push(WebSearchPrompt(args, logical_results))
	result.push(WebBrowsePrompt(args, logical_results))
	result.push(CodeRunnerPrompt(args, logical_results))
	result.push(FileChangePrompt(args, logical_results))
	result.push(HostInfoPrompt(args, logical_results))
	result.push(CameraPrompt(args, logical_results))
	result.push(ScreenshotPrompt(args, logical_results))
	result.push(RudePrompt(args, logical_results))
	result.push(PromptReviewerPrompt(args, logical_results))
	result.push(BrowserIntegrationPrompt(args, logical_results))
	result.push(IdleManagementPrompt(args, logical_results))
	result.push(NotifyPrompt(args, logical_results))
	if (args.supported_functions.add_message)
		result.push(TimerPrompt(args, logical_results))
	result.push(CharGeneratorPrompt(args, logical_results))
	result.push(StatisticDatasPrompt(args, logical_results))
	result.push(RockPaperScissorsPrompt(args, logical_results))
	result.push(DicePrompt(args, logical_results))
	result.push(AutoCalcPrompt(args, logical_results))
	result.push(NumberAlchemistPrompt(args, logical_results))
	result.push(KanjiPrompt(args, logical_results))
	result.push(TaroPrompt(args, logical_results))
	result.push(PoemPrompt(args, logical_results))
	result.push(CorpusGeneratorPrompt(args, logical_results))
	result.push(ChineseGrammarCorrectionPrompt(args, logical_results))
	result.push(PromptWriterPrompt(args, logical_results))
	result.push(QrcodeParserPrompt(args, logical_results))
	result.push(InfoPrompt(args, logical_results))
	return mergePrompt(...result)
}
