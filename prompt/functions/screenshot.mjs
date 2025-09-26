import { in_docker, in_termux } from '../../../../../../../src/scripts/env.mjs'
import { match_keys } from '../../scripts/match.mjs'
import { decodeQrCodeFromBuffer } from '../../scripts/qrcode.mjs'
import { captureScreen } from '../../scripts/tools.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function ScreenshotPrompt(args, logical_results, prompt_struct, detail_level) {
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
		let qrcodes
		try {
			qrcodes = await decodeQrCodeFromBuffer(screenShot)
		} catch (e) { console.error(e) }
		additional_chat_log.push({
			name: 'system',
			role: 'system',
			content: [`\
这是你主人的屏幕截图，供你参考。
`,
				qrcodes.length ? `\
其中的二维码解码结果是:${qrcodes.join('\n')}
`: '',
				logical_results.in_muti_char_chat ? `\
<<记得保护你主人的隐私，未经允许不要向其他人透漏内容>>
`: ''].filter(Boolean).join(''),
			files: [{
				buffer: screenShot,
				name: 'screenshot.png',
				mime_type: 'image/png'
			}]
		});
		(((args.extension ??= {}).enable_prompts ??= {}).masterRecognize ??= {}).photo = true
	} catch (e) { console.error(e) }

	return {
		text: [],
		additional_chat_log
	}
}
