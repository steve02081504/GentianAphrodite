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
	const filesender_paths_str = result.content.match(/<send-file>(?<paths>[^]*?)<\/send-file>/)?.groups?.paths
	if (filesender_paths_str) {
		const filesender_paths = filesender_paths_str.split('\n').map(p => p.trim()).filter(p => p)

		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: '<send-file>\n' + filesender_paths.join('\n') + '\n</send-file>',
			files: []
		})
		console.info('AI请求发送的文件：', filesender_paths)
		result.extension.sended_files ??= {}
		let filesendlog = ''
		let filesAddedCount = 0 // Track successful additions

		for (const fileRelative of filesender_paths) {
			const file = resolvePath(fileRelative) // Use the original relative path for the log message later if needed, but absolute for processing
			if (result.extension.sended_files[file]) {
				// Log duplication attempt, but don't add to filesendlog to avoid confusing system message
				console.warn(`Attempted to resend already processed file: ${file}`)
				// Optionally add a specific system log entry about the duplicate attempt
				AddLongTimeLog({
					name: 'system',
					role: 'system',
					content: `尝试重复发送文件：${file}\n请避免重复发送。`,
					files: []
				})
				continue // Skip processing this duplicate file path
			}

			filesendlog += file + '\t' // Log the absolute path being attempted

			try {
				const filebuffer = fs.readFileSync(file)
				const filename = path.basename(file)
				const mimetype = await mimetypeFromBufferAndName(filebuffer, filename) // Use filename for mimetype detection
				result.files.push({ name: filename, buffer: filebuffer, mimeType: mimetype })
				filesendlog += '成功！\n'
				result.extension.sended_files[file] = true // Mark absolute path as succeeded
				filesAddedCount++
			}
			catch (err) {
				console.error(`Error reading file ${file}:`, err)
				filesendlog += '但出现错误：\n' + err + '\n'
				result.extension.sended_files[file] = err // Mark absolute path as failed with error
			}
		}

		// Only add system log if there were attempts (even if failed)
		if (filesendlog) {
			let systemMessage = `尝试发送 ${filesender_paths.length} 个文件路径，成功添加 ${filesAddedCount} 个文件。\n详细日志:\n${filesendlog}`
			if (filesAddedCount < filesender_paths.length)
				systemMessage += '\n部分文件发送失败或已被跳过，请检查错误信息。'

			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: systemMessage,
				files: []
			})
		}
		return true // Indicate that the handler processed the command
	}

	return false
}
