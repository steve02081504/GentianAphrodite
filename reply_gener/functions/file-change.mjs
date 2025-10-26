import fs from 'node:fs'

import { unlockAchievement } from '../../scripts/achievements.mjs'
import { getFileObjFormPathOrUrl, resolvePath } from '../../scripts/fileobj.mjs'
import { statisticDatas } from '../../scripts/statistics.mjs'
import { escapeRegExp, parseRegexFromString } from '../../scripts/tools.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export async function file_change(result, { AddLongTimeLog }) {
	const view_files_match = result.content.match(/<view-file>(?<paths>[^]*?)<\/view-file>/)?.groups?.paths
	let regen = false
	const tool_calling_log = {
		name: '龙胆',
		role: 'char',
		content: '',
		files: []
	}

	if (view_files_match) {
		const paths = view_files_match.split('\n').map(p => p.trim()).filter(path => path)
		if (paths.length) {
			unlockAchievement('use_file_change')
			const logContent = '<view-file>\n' + paths.join('\n') + '\n</view-file>\n'
			if (!tool_calling_log.content) {
				tool_calling_log.content += logContent
				AddLongTimeLog(tool_calling_log) // Add log only once if it wasn't added before
			}
			else tool_calling_log.content += logContent // Append if already added

			console.info('AI查看的文件：', paths)
			const files = []
			let file_content = ''
			for (const path of paths)
				try {
					const fileObj = await getFileObjFormPathOrUrl(path)
					if (fileObj.mime_type.startsWith('text/')) {
						const content = await fs.promises.readFile(resolvePath(path), 'utf-8')
						file_content += `文件：${path}\n\`\`\`\n${content}\n\`\`\`\n`
					}
					else {
						files.push(fileObj)
						file_content += `文件：${path}读取成功，放置于附件。\n`
					}
				}
				catch (err) {
					file_content += `读取文件失败：${path}\n\`\`\`\n${err.stack}\n\`\`\`\n`
				}

			AddLongTimeLog({
				name: 'file-change',
				role: 'tool',
				content: file_content,
				files
			})
		}
		statisticDatas.toolUsage.fileOperations++
		regen = true
	}

	const replace_file_content = result.content.match(/<replace-file>(?<content>[^]*?)<\/replace-file>/)?.groups?.content
	if (replace_file_content) {
		unlockAchievement('use_file_change')
		const logContent = '<replace-file>' + replace_file_content + '</replace-file>\n'
		if (!tool_calling_log.content) {
			tool_calling_log.content += logContent
			AddLongTimeLog(tool_calling_log)
		}
		else tool_calling_log.content += logContent

		const replace_files_data = [] // Structure to hold data compatible with old logic

		try {
			// Regex to find each <file> block
			const fileRegex = /<file\s+path="(?<path>[^"]+)">(?<replacements_str>[^]*?)<\/file>/g
			// Regex to find each <replacement> block within a <file> block
			const replacementRegex = /<replacement(?<attributes>[^>]*)>\s*<search>(?<search>[^]*?)<\/search>\s*<replace>(?<replace>[^]*?)<\/replace>\s*<\/replacement>/g

			for (const fileMatch of replace_file_content.matchAll(fileRegex)) {
				const { path, replacements_str } = fileMatch.groups
				if (!path) continue // Should not happen with this regex, but a good safeguard

				const fileData = {
					path,
					replacements: []
				}

				for (const repMatch of replacements_str.matchAll(replacementRegex)) {
					const { attributes, search, replace } = repMatch.groups

					if (search === undefined || replace === undefined) {
						console.warn('Skipping malformed <replacement> block for path:', path)
						continue
					}

					// Check for regex="true" in attributes. A simple .includes() is robust enough.
					const isRegex = attributes?.includes('regex="true"') ?? false

					fileData.replacements.push({
						// Use trim() to be consistent with the previous XML parser's `trimValues: true` option
						search: search.trim(),
						replace, // Do not trim replace content, as whitespace might be significant
						regex: isRegex
					})
				}

				if (fileData.replacements.length)
					replace_files_data.push(fileData)
			}

			if (!replace_files_data.length)
				throw new Error('解析<replace-file>标签后，未找到任何有效的<file>或<replacement>操作。')
		}
		catch (err) {
			console.error('Error parsing replace-file content with regex:', err)
			AddLongTimeLog({
				name: 'file-change',
				role: 'tool',
				content: `解析replace-file失败：\n\`\`\`\n${err}\n\`\`\`\n原始数据:\n<replace-file>${replace_file_content}</replace-file>`,
				files: []
			})
			return true // Stop processing this command
		}

		console.info('AI替换的文件：', replace_files_data)

		for (const replace_file of replace_files_data) {
			const { path, replacements } = replace_file
			const failed_replaces = []
			let replace_count = 0
			let originalContent
			try {
				originalContent = await fs.promises.readFile(resolvePath(path), 'utf-8')
			}
			catch (err) {
				AddLongTimeLog({
					name: 'file-change',
					role: 'tool',
					content: `读取文件失败：${path}\n\`\`\`\n${err.stack}\n\`\`\`\n`,
					files: []
				})
				continue
			}

			let modifiedContent = originalContent

			for (const rep of replacements) {
				const { search, replace, regex } = rep
				try {
					const replaceRegex = regex ? parseRegexFromString(search) : new RegExp(escapeRegExp(search), 'gu')
					const before = modifiedContent
					modifiedContent = modifiedContent.replace(replaceRegex, replace)
					if (before != modifiedContent) replace_count++
				}
				catch (err) {
					console.error(`Replacement failed for path ${path}, search "${search}", regex: ${regex}:`, err)
					failed_replaces.push({ ...rep, error: err.message || String(err) })
				}
			}

			let system_content = ''
			if (originalContent !== modifiedContent) {
				system_content = `文件 ${path} 内容已修改，应用了 ${replacements.length} 项替换`
				if (replace_count > 0) system_content += `，其中 ${replace_count} 个替换成功。\n`
				else system_content += '，但内容未发生实际变化。\n'
			}
			else system_content = `文件 ${path} 内容未发生变化（尝试了 ${replacements.length} 项替换规则）。\n`

			if (failed_replaces.length) {
				system_content += `以下 ${failed_replaces.length} 处替换操作失败：\n`
				system_content += '```json\n' + JSON.stringify(failed_replaces, null, '\t') + '\n```\n'
			}

			if (originalContent !== modifiedContent) {
				system_content += `\n最终文件内容：\n\`\`\`\n${modifiedContent}\n\`\`\`\n若和你的预期不一致，考虑重新替换或使用override-file覆写修正。`
				try {
					await fs.promises.writeFile(resolvePath(path), modifiedContent, 'utf-8')
				}
				catch (err) {
					system_content = `写入文件失败：${path}\n\`\`\`\n${err.stack}\n\`\`\`\n`
				}
			}
			// If content didn't change AND no errors, explicitly state that
			else if (!failed_replaces.length) system_content += '所有替换规则均未匹配到内容或未导致文件变化。'

			AddLongTimeLog({
				name: 'file-change',
				role: 'tool',
				content: system_content,
				files: []
			})
		}
		statisticDatas.toolUsage.fileOperations++
		regen = true
	}

	const override_file_match = result.content.match(/<override-file\s+path="(?<path>[^"]+)">(?<content>[^]*?)<\/override-file>/)?.groups
	if (override_file_match) {
		unlockAchievement('use_file_change')
		const { path, content } = override_file_match
		const logContent = `<override-file path="${path}">` + content + '</override-file>\n'
		if (!tool_calling_log.content) {
			tool_calling_log.content += logContent
			AddLongTimeLog(tool_calling_log)
		}
		else tool_calling_log.content += logContent

		console.info('AI写入的文件：', path, content)
		try {
			await fs.promises.writeFile(resolvePath(path), content.trim() + '\n', 'utf-8')
			AddLongTimeLog({
				name: 'file-change',
				role: 'tool',
				content: `文件 ${path} 已写入`,
				files: []
			})
		}
		catch (err) {
			AddLongTimeLog({
				name: 'file-change',
				role: 'tool',
				content: `写入文件失败：${path}\n\`\`\`\n${err.stack}\n\`\`\`\n`,
				files: []
			})
		}
		statisticDatas.toolUsage.fileOperations++
		regen = true
	}

	return regen
}
