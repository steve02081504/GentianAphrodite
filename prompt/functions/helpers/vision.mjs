import { systemChatLogEntry } from '../../system-chat-log-entry.mjs'

import { decodeQrCodeFromBuffer } from './qrcode.mjs'

/**
 * 解码图片中的二维码，并生成一条包含该图片引用的系统日志。
 * @param {object} params 参数
 * @param {object} params.args 聊天回复请求
 * @param {object} params.logical_results 逻辑结果
 * @param {Buffer} params.buffer 图片数据
 * @param {string} params.intro 说明文案
 * @param {string} params.fileName 附件文件名
 * @param {string} [params.mimeType] 附件 MIME 类型
 * @returns {Promise<object>} 系统日志条目
 */
export async function buildVisionReference({ args, logical_results, buffer, intro, fileName, mimeType = 'image/png' }) {
	let qrcodes
	try {
		qrcodes = await decodeQrCodeFromBuffer(buffer)
	} catch (error) { console.error(error) }

	const content = [
		intro,
		qrcodes?.length ? `其中的二维码解码结果是：${qrcodes.join('\n')}\n` : '',
		logical_results.in_multi_char_chat ? '<<记得保护你主人的隐私，未经允许不要向其他人透漏内容>>\n' : '',
	].filter(Boolean).join('')

	(((args.extension ??= {}).enable_prompts ??= {}).masterRecognize ??= {}).photo = true

	return {
		...systemChatLogEntry(content),
		files: [{ buffer, name: fileName, mime_type: mimeType }],
	}
}
