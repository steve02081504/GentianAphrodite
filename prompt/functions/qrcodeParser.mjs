import { decodeQrCodeFromBuffer } from '../../scripts/qrcode.mjs'
import { findUrlsInText, getUrlMetadata } from '../../scripts/web.mjs'
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
			const decodedContents = qrcodes.flat()
			const urls = decodedContents.flatMap(content => findUrlsInText(content))
			const metas = (await Promise.all(urls.map(async url => {
				const meta = await getUrlMetadata(url)
				if (meta?.length) return `\`${url}\`：\n${meta.join('\n')}`
			}))).filter(Boolean)

			let content = `上条消息中图片内的二维码内容是：\n\`\`\`${decodedContents.join('\n')}\`\`\``
			if (metas.length)
				content += `\n其中，链接的元信息如下：\n${metas.join('\n')}`

			log.logContextAfter ??= []
			log.logContextAfter.push({
				name: 'system',
				role: 'system',
				content,
				charVisibility: [args.char_id]
			})
		}
	}

	return {
		text: [],
		additional_chat_log: []
	}
}
