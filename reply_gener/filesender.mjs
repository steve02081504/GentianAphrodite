import fs from 'fs'
import path from 'path'
import mime from 'mime-types'
import os from 'os'
/** @typedef {import("../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

function resolvePath(relativePath) {
	if (relativePath.startsWith('~'))
		return path.join(os.homedir(), relativePath.slice(1))
	return path.resolve(relativePath)
}

/**
 * @param {chatLogEntry_t} result
 * @param {prompt_struct_t} prompt_struct
 * @returns {Promise<boolean>}
 */
export async function filesender(result, prompt_struct) {
	let filesender = result.content.match(/(\n|^)```send-file\n(?<file>[^]*)\n```/)?.groups?.file
	if (filesender) {
		filesender = filesender.split('\n')
		prompt_struct.char_prompt.additional_chat_log.push({
			name: '龙胆',
			role: 'char',
			content: '```send-file\n' + filesender.join('\n') + '\n```',
			files: []
		})
		console.log('AI发送了文件：', filesender)
		result.extension.sended_files ??= {}
		let filesendlog = '你发送了文件：\n'
		for (let file of filesender) {
			file = resolvePath(file)
			if (result.extension.sended_files[file])
				prompt_struct.char_prompt.additional_chat_log.push({
					name: 'system',
					role: 'system',
					content: '你已经发送过文件：\n' + file + '\n**请根据生成不带文件发送语法的回复而不是重复发送已发送的内容**',
					files: []
				})
			filesendlog += file + '\t'
			try {
				let filebuffer = fs.readFileSync(file)
				result.files.push({ name: path.basename(file), content: filebuffer, mimeType: mime.lookup(file) || 'application/octet-stream' })
				filesendlog += '成功！\n'
				result.extension.sended_files[file] = true
			}
			catch (err) {
				filesendlog += '但出现错误：\n' + err + '\n'
				result.extension.sended_files[file] = err
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
