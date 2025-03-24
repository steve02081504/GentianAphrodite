import { fileTypeFromBuffer } from 'npm:file-type'
import mime from 'npm:mime-types'

/**
 * @param {Buffer} buffer
 */
export async function mimetypeFromBufferAndName(buffer, name) {
	let mimetype = (await fileTypeFromBuffer(buffer))?.mime
	mimetype ||= mime.lookup(name)
	mimetype ||= buffer.toString('utf-8').isWellFormed() ? 'text/plain' : undefined
	mimetype ||= 'application/octet-stream'
	return mimetype
}
