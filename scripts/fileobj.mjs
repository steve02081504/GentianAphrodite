import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { getFileExtFormMimetype, mimetypeFromBufferAndName } from './mimetype.mjs'
import { getUrlFilename } from './web.mjs'

const msys_path = process.env.MSYS_ROOT_PATH
/**
 * 解析相对路径，支持 `~` (home) 和 MSYS 风格的路径 (例如 `/c/Users`)。
 * @param {string} relativePath - 要解析的相对路径。
 * @returns {string} - 解析后的绝对路径。
 */
export function resolvePath(relativePath) {
	if (relativePath.startsWith('~'))
		return path.resolve(path.join(os.homedir(), relativePath.slice(1)))
	if (msys_path && relativePath.startsWith('/')) {
		if (relativePath.match(/^\/[A-Za-z]\//))
			return path.resolve(path.join(relativePath.slice(1, 2).toUpperCase() + ':\\', relativePath.slice(3)))
		return path.resolve(path.join(msys_path, relativePath))
	}
	return path.resolve(relativePath)
}

/**
 * 从本地文件路径或 URL 创建一个文件对象。
 * 文件对象包含 `name`、`buffer` 和 `mime_type` 属性。
 * @param {string} pathOrUrl - 文件的本地路径或 URL。
 * @returns {Promise<{name: string, buffer: Buffer, mime_type: string}>} - 包含文件信息的文件对象。
 */
export async function getFileObjFormPathOrUrl(pathOrUrl) {
	if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
		const response = await fetch(pathOrUrl)
		if (!response.ok) throw new Error('fetch failed.')
		const contentDisposition = response.headers.get('Content-Disposition')
		let name = getUrlFilename(pathOrUrl, contentDisposition)
		const buffer = Buffer.from(await response.arrayBuffer())
		const mime_type = response.headers.get('content-type') || await mimetypeFromBufferAndName(buffer, name || 'downloaded.bin')
		name ||= 'downloaded.' + (getFileExtFormMimetype(mime_type) || 'bin')
		pathOrUrl = { name, buffer, mime_type }
	}
	else {
		const filePath = resolvePath(pathOrUrl)
		const buffer = fs.readFileSync(filePath)
		const name = path.basename(filePath)
		pathOrUrl = { name, buffer, mime_type: await mimetypeFromBufferAndName(buffer, name) }
	}

	return pathOrUrl
}

/**
 * 将输入（文件路径、URL 或部分文件对象）规范化为一个完整的文件对象。
 * 完整的文件对象保证包含 `name`、`buffer` 和 `mime_type` 属性。
 * @param {string | {name: string, buffer: Buffer | ArrayBuffer, mime_type?: string}} pathOrFileObj - 输入，可以是文件路径、URL 或一个至少包含 `name` 和 `buffer` 的对象。
 * @returns {Promise<{name: string, buffer: Buffer, mime_type: string}>} - 规范化后的文件对象。
 * @throws {Error} 如果输入是无效的格式。
 */
export async function toFileObj(pathOrFileObj) {
	if (Object(pathOrFileObj) instanceof String)
		return getFileObjFormPathOrUrl(pathOrFileObj)

	if (pathOrFileObj instanceof Object && 'name' in pathOrFileObj && 'buffer' in pathOrFileObj) {
		const buffer = Buffer.isBuffer(pathOrFileObj.buffer) ? pathOrFileObj.buffer : Buffer.from(pathOrFileObj.buffer)
		const mime_type = pathOrFileObj.mime_type || await mimetypeFromBufferAndName(buffer, pathOrFileObj.name)
		return { name: pathOrFileObj.name, buffer, mime_type }
	}
	else
		throw new Error('无效的输入参数。期望为文件路径字符串、URL字符串或包含name和buffer属性的对象。')
}
