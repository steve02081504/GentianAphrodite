import { Monitor } from 'npm:node-screenshots'
import { NdiffResults, PickRandomN, random, repetRandomTimes, emptyForChance } from '../../scripts/random.mjs'
import { getScopedChatLog, match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

async function captureScreen() {
	const monitors = Monitor.all()
	const mainMonitor = monitors[0]
	const image = await mainMonitor.captureImage()

	return await image.toPng()
}

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function ScreenshotPrompt(args, logical_results, prompt_struct, detail_level) {
	let additional_chat_log = []

	if (await match_keys(args, ['屏幕上', '电脑上'], 'any', 2)) try {
		const screenShot = await captureScreen()
		additional_chat_log.push({
			name: 'system',
			role: 'system',
			content: `\
这是你主人的屏幕截图，供你参考。
`,
			files: [{
				buffer: screenShot,
				name: 'screenshot.png',
				mimeType: 'image/png'
			}]
		})
	} catch (e) {
		console.error(e)
	}

	return {
		text: [],
		additional_chat_log
	}
}
