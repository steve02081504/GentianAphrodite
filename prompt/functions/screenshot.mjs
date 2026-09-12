import { in_docker, in_termux } from '../../../../../../../src/scripts/env.mjs'
import { match_keys } from '../../scripts/match.mjs'
import { captureScreen } from '../../scripts/tools/index.mjs'

import { buildVisionReference } from './helpers/vision.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * 截图提示函数
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑处理结果。
 * @returns {Promise<single_part_prompt_t>} - 可能带有截图的Prompt
 */
export async function ScreenshotPrompt(args, logical_results) {
	const additional_chat_log = []

	if (!(in_docker || in_termux) && (args.extension?.enable_prompts?.screenshot || (
		await match_keys(args, ['屏幕上', '电脑上', '显示屏上', '荧幕上'], 'any', 2) || (
			await match_keys(args, ['屏幕', '电脑', '显示屏', '荧幕'], 'any', 2) &&
			await match_keys(args, ['看看', '看到', '看下', '看一下', '有什', '有啥'], 'any', 2)
		) || (
			await match_keys(args, [/看.{0,2}我/, '现在', /在(干|做|弄些?)什/], 'user', 2) >= 3
		)
	))) try {
		/** @type {Buffer} */
		const screenShot = await captureScreen()
		additional_chat_log.push(await buildVisionReference({
			args,
			logical_results,
			buffer: screenShot,
			intro: '这是你主人的屏幕截图，供你参考。\n',
			fileName: 'screenshot.png',
		}))
	} catch (e) { console.error(e) }

	return {
		text: [],
		additional_chat_log
	}
}
