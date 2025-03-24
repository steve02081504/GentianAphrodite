import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { mimetypeFromBufferAndName } from '../../scripts/mimetype.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

function resolvePath(relativePath) {
	if (relativePath.startsWith('~'))
		return path.join(os.homedir(), relativePath.slice(1))
	return path.resolve(relativePath)
}

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export async function filesender(result, { AddLongTimeLog }) {
	let filesender = result.content.match(/```send-file\n(?<file>[^]*?)\n```/)?.groups?.file
	if (filesender) {
		filesender = filesender.split('\n')
		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: '```send-file\n' + filesender.join('\n') + '\n```',
			files: []
		})
		console.info('AI发送了文件：', filesender)
		result.extension.sended_files ??= {}
		let filesendlog = ''
		for (let file of filesender) {
			file = resolvePath(file)
			if (result.extension.sended_files[file]) {
				AddLongTimeLog({
					name: 'system',
					role: 'system',
					content: '你已经发送过文件：\n' + file + '\n**请根据生成不带文件发送语法的回复而不是重复发送已发送的内容**',
					files: []
				})
				continue
			}
			filesendlog += file + '\t'
			try {
				const filebuffer = fs.readFileSync(file)
				result.files.push({ name: path.basename(file), buffer: filebuffer, mimeType: await mimetypeFromBufferAndName(filebuffer, file) })
				filesendlog += '成功！\n'
				result.extension.sended_files[file] = true
			}
			catch (err) {
				filesendlog += '但出现错误：\n' + err + '\n'
				result.extension.sended_files[file] = err
			}
		}
		if (filesendlog)
			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: '你发送了文件：\n' + filesendlog,
				files: []
			})
		return true
	}

	return false
}
