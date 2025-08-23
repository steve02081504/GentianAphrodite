import { fileTypeFromBuffer } from 'npm:file-type@^21.0.0'
import mime from 'npm:mime'
import mimetype from 'npm:mime-types'

/**
 * @param {Buffer} buffer
 */
export async function mimetypeFromBufferAndName(buffer, name) {
	let result = (await fileTypeFromBuffer(buffer))?.mime
	result ||= mimetype.lookup(name)
	result ||= buffer.toString('utf-8').isWellFormed() ? 'text/plain' : undefined
	result ||= 'application/octet-stream'
	return result
}

export function getFileExtFormMimetype(type) {
	return mime.getExtension(type)
}
