import fs from 'node:fs/promises'

import { in_docker, in_termux } from '../../../../../../../src/scripts/env.mjs'
import { match_keys } from '../../scripts/match.mjs'
import { decodeQrCodeFromBuffer } from '../../scripts/qrcode.mjs'

/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * 从物理摄像头捕获图像，并确保临时文件被清理。
 * @returns {Promise<Buffer>} 图像数据的Buffer。
 * @throws 如果捕获失败或未返回数据，则抛出错误。
 */
async function captureWebcam() {
	const { default: Webcam } = await import('npm:node-webcam')
	return await new Promise((resolve, reject) => {
		const cam = Webcam.create({
			width: 1280,
			height: 720,
			quality: 100,
			delay: 0,
			output: 'png',
			device: false,
			callbackReturn: 'buffer',
			verbose: false
		})

		// node-webcam的capture方法第一个参数是文件名（不含扩展名）
		cam.capture('temp_webcam_capture', (err, data) => {
			if (err) return reject(err)
			if (data) return resolve(data)
			reject(new Error('摄像头捕获成功，但未返回任何数据。'))
		})
	}).finally(() => fs.unlink('temp_webcam_capture.png').catch(() => { }))
}

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function CameraPrompt(args, logical_results, prompt_struct, detail_level) {
	const additional_chat_log = []

	if (!(in_docker || in_termux) && (args.extension?.enable_prompts?.camera || (
		await match_keys(args, ['屏幕前', '电脑前', '荧幕前'], 'any', 2) || (
			await match_keys(args, ['摄像头', '录像', '显示屏', '荧幕'], 'any', 2) &&
			await match_keys(args, ['看看', '看到', '看下', '看一下', '有什', '有啥'], 'any', 2)
		) || (
			await match_keys(args, [/看.{0,2}我/, '我现在', '颜值', '穿搭', '脸', '面相', '身材', '手里', '脸上', '身上', '什么'], 'user', 2) >= 3
		)
	))) try {
		/** @type {Buffer} */
		const screenShot = await captureWebcam()
		let qrcodes
		try {
			qrcodes = await decodeQrCodeFromBuffer(screenShot)
		} catch (e) {
			console.error(e)
		}
		additional_chat_log.push({
			name: 'system',
			role: 'system',
			content: [`\
这是你主人的摄像头照片，供你参考。
`,
				qrcodes.length ? `\
其中的二维码解码结果是:${qrcodes.join('\n')}
`: '',
				logical_results.in_muti_char_chat ? `\
<<记得保护你主人的隐私，未经允许不要向其他人透漏内容>>
`: ''].filter(Boolean).join(''),
			files: [{
				buffer: screenShot,
				name: 'camera.png',
				mime_type: 'image/png'
			}]
		});
		(((args.extension ??= {}).enable_prompts ??= {}).masterRecognize ??= {}).photo = true
	} catch (e) {
		console.error(e)
	}

	return {
		text: [],
		additional_chat_log
	}
}
