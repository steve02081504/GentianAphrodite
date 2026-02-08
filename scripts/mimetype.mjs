import { fileTypeFromBuffer } from 'npm:file-type'
import mime from 'npm:mime'
import mimetype from 'npm:mime-types'

/**
 * 根据文件内容（Buffer）和文件名推断 MIME 类型。
 * @param {Buffer} buffer - 文件的 Buffer 内容。
 * @param {string} name - 文件名。
 * @returns {Promise<string>} - 推断出的 MIME 类型。
 */
export async function mimetypeFromBufferAndName(buffer, name) {
	let result = (await fileTypeFromBuffer(buffer))?.mime
	result ||= mimetype.lookup(name)
	result ||= buffer.toString('utf-8').isWellFormed() ? 'text/plain' : undefined
	result ||= 'application/octet-stream'
	return result
}

/**
 * 根据 MIME 类型获取文件扩展名。
 * @param {string} type - MIME 类型。
 * @returns {string | null} - 对应的文件扩展名，如果找不到则返回 null。
 */
export function getFileExtFormMimetype(type) {
	return mime.getExtension(type)
}
