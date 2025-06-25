import { decodeQrCodeFromBuffer } from '../../scripts/qrcode.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function qrcodeParserPrompt(args, logical_results, prompt_struct, detail_level) {
	const logs = args.chat_log.slice(-20)

	for (const log of logs) {
		if (log.extension?.decodedQRCodes) continue
		const imgs = (log.files || []).filter(x => x.mime_type.startsWith('image/'))
		const qrcodes = (await Promise.all(
			imgs.map(img => decodeQrCodeFromBuffer(img.buffer))
		)).filter(arr => arr.length)

		if (qrcodes.length) {
			log.extension.decodedQRCodes = qrcodes
			log.logContextAfter ??= []
			log.logContextAfter.push({
				name: 'system',
				role: 'system',
				content: `\
上条消息中图片内的二维码内容是：
${qrcodes.map(x => x.join('\n')).join('\n')}
`,
				charVisibility: [args.char_id]
			})
		}
	}

	return {
		text: [],
		additional_chat_log: []
	}
}
