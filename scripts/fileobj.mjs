import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { getFileExtFormMimetype, mimetypeFromBufferAndName } from './mimetype.mjs'
import { getUrlFilename } from './web.mjs'

const msys_path = process.env.MSYS_ROOT_PATH
/**
 * @param {string} relativePath
 * @returns {string}
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
