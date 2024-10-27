import fs from 'fs'
import path from 'path'
import mime from 'mime-types'
/** @typedef {import("../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatLogEntry_t} result
 * @param {prompt_struct_t} prompt_struct
 * @returns {Promise<boolean>}
 */
export async function filesender(result, prompt_struct) {
	let filesender = result.content.match(/(\n|^)```send-file\n(?<file>[^]*)\n```/)?.groups?.file
	if (filesender) {
		filesender = filesender.split('\n')
		console.log('AI发送了文件：', filesender)
		let filesendlog = '你发送了文件：\n'
		for (let file of filesender) {
			filesendlog += file + '\t'
			try {
				let filebuffer = fs.readFileSync(file)
				result.files.push({ name: path.basename(file), content: filebuffer, mimeType: mime.lookup(file) || 'application/octet-stream' })
				filesendlog += '一切正常！\n'
			}
			catch (err) {
				filesendlog += '但出现错误：\n' + err + '\n'
			}
		}
		prompt_struct.char_prompt.additional_chat_log.push({
			name: 'system',
			role: 'system',
			content: filesendlog,
			files: []
		})
		return true
	}

	return false
}
