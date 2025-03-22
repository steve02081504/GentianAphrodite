import fs from 'node:fs'
import { homedir } from 'node:os'
import { escapeRegExp, parseRegexFromString } from '../../scripts/tools.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export async function file_change(result, { AddLongTimeLog }) {
	const view_files = result.content.match(/```view-file\n(?<paths>([^\n]*\n)+)```/)?.groups?.paths
	let regen = false
	const tool_calling_log = {
		name: '龙胆',
		role: 'char',
		content: '',
		files: []
	}
	if (view_files) {
		const paths = view_files.split('\n').filter(path => path)
		if (paths.length) {
			if (!tool_calling_log.content) AddLongTimeLog(tool_calling_log)
			tool_calling_log.content += '```view-file\n' + paths.join('\n') + '\n```\n'
			console.info('AI查看的文件：', paths)
			let file_content = ''
			for (const path of paths)
				try {
					const content = await fs.promises.readFile(path.replace(/^~\//, homedir() + '/'), 'utf-8')
					file_content += `文件：${path}\n\`\`\`\n${content}\n\`\`\`\n`
				} catch (err) {
					file_content += `读取文件失败：${path}\n\`\`\`\n${err.stack}\n\`\`\`\n`
				}

			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: file_content,
				files: []
			})
		}
		regen = true
	}
	const replace_file_json_str = result.content.match(/```replace-file\n(?<json>[^]+)\n```/)?.groups?.json
	if (replace_file_json_str) {
		if (!tool_calling_log.content) AddLongTimeLog(tool_calling_log)
		let replace_files
		try {
			replace_files = JSON.parse(replace_file_json_str)
		}
		catch (err) {
			tool_calling_log.content += '```replace-file\n' + replace_file_json_str + '\n```\n'
			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: `解析replace-file的JSON失败：\n\`\`\`\n${err}\n\`\`\``,
				files: []
			})
			return true
		}
		tool_calling_log.content += '```replace-file\n' + JSON.stringify(replace_files, null, '\t') + '\n```\n',
		console.info('AI替换的文件：', replace_files)

		for (const replace_file of replace_files) {
			const { path, replacements } = replace_file
			const failed_replaces = []
			let replace_count = 0
			let originalContent
			try {
				originalContent = await fs.promises.readFile(path.replace(/^~\//, homedir() + '/'), 'utf-8')
			} catch (err) {
				AddLongTimeLog({
					name: 'system',
					role: 'system',
					content: `读取文件失败：${path}\n\`\`\`\n${err}\n\`\`\`\n`,
					files: []
				})
				continue
			}

			let modifiedContent = originalContent

			for (const rep of replacements) {
				const { search, replace, regex } = rep
				try {
					const replaceRegex = regex ? parseRegexFromString(search) : new RegExp(escapeRegExp(search), 'gu')
					modifiedContent = modifiedContent.replace(replaceRegex, replace)
					replace_count++
				}
				catch (err) {
					failed_replaces.push({ ...rep, error: err })
				}
			}

			let system_content
			if (originalContent != modifiedContent)
				system_content = `文件 ${path} 完成 ${replace_count} 处替换。\n`
			else
				system_content = `文件 ${path} 没有任何替换。\n`

			if (failed_replaces.length) {
				system_content += `以下 ${failed_replaces.length} 处替换失败：\n`
				system_content += '```json\n' + JSON.stringify(failed_replaces, null, 2) + '\n```\n'
			}
			if (originalContent != modifiedContent)
				system_content += `\n最终文件内容：\n\`\`\`\n${modifiedContent}\n\`\`\`\n若和你的预期不一致，考虑重新替换或使用override-file覆写修正。`
			try {
				await fs.promises.writeFile(path.replace(/^~\//, homedir() + '/'), modifiedContent, 'utf-8')
			} catch (err) {
				system_content = `写入文件失败：${path}\n\`\`\`\n${err.stack}\n\`\`\`\n`
			}
			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: system_content,
				files: []
			})
		}
		regen = true
	}
	const override_file = result.content.match(/```override-file (?<path>[^\n]+)\n(?<content>[^]*)\n```/)?.groups
	if (override_file) {
		const { path, content } = override_file
		if (!tool_calling_log.content) AddLongTimeLog(tool_calling_log)
		tool_calling_log.content += '```override-file ' + path + '\n' + content + '\n```',
		console.info('AI写入的文件：', path, content)
		try {
			await fs.promises.writeFile(path.replace(/^~\//, homedir() + '/'), content, 'utf-8')
			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: `文件 ${path} 已写入`,
				files: []
			})
		} catch (err) {
			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: `写入文件失败：${path}\n\`\`\`\n${err.stack}\n\`\`\`\n`,
				files: []
			})
		}
		regen = true
	}

	return regen
}
