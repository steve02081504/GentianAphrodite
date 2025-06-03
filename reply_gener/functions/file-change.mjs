import fs from 'node:fs'
import { escapeRegExp, parseRegexFromString } from '../../scripts/tools.mjs'
import { XMLParser, XMLValidator } from 'npm:fast-xml-parser'
import { statisticDatas } from '../../scripts/statistics.mjs'
import { getFileObjFormPathOrUrl, resolvePath } from '../../scripts/fileobj.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

// XML Parser options
const xmlParserOptions = {
	ignoreAttributes: false,
	attributeNamePrefix: '', // No prefix for attributes
	allowBooleanAttributes: true, // Allow attributes like regex="true"
	parseAttributeValue: true, // Try to parse numbers/booleans in attributes
	parseTagValue: false,
	trimValues: true, // Trim whitespace
	// Ensure arrays are created even for single elements for consistency
	isArray: (name, jpath, isLeafNode, isAttribute) => {
		return ['file', 'replacement'].includes(name)
	}
}
const parser = new XMLParser(xmlParserOptions)

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
			const logContent = '<view-file>\n' + paths.join('\n') + '\n</view-file>\n'
			if (!tool_calling_log.content) {
				tool_calling_log.content += logContent
				AddLongTimeLog(tool_calling_log) // Add log only once if it wasn't added before
			} else
				tool_calling_log.content += logContent // Append if already added

			console.info('AI查看的文件：', paths)
			const files = []
			let file_content = ''
			for (const path of paths)
				try {
					const fileObj = await getFileObjFormPathOrUrl(path)
					if (fileObj.mimeType.startsWith('text/')) {
						const content = await fs.promises.readFile(resolvePath(path), 'utf-8')
						file_content += `文件：${path}\n\`\`\`\n${content}\n\`\`\`\n`
					}
					else {
						files.push(fileObj)
						file_content += `文件：${path}读取成功，放置于附件。\n`
					}
				} catch (err) {
					file_content += `读取文件失败：${path}\n\`\`\`\n${err.stack}\n\`\`\`\n`
				}

			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: file_content,
				files
			})
		}
		statisticDatas.toolUsage.fileOperations++
		regen = true
	}

	const replace_file_xml_str = result.content.match(/<replace-file>(?<xmlContent>[^]*?)<\/replace-file>/)?.groups?.xmlContent
	if (replace_file_xml_str) {
		const logContent = '<replace-file>' + replace_file_xml_str + '</replace-file>\n'
		if (!tool_calling_log.content) {
			tool_calling_log.content += logContent
			AddLongTimeLog(tool_calling_log)
		} else
			tool_calling_log.content += logContent


		let parsedXml
		const replace_files_data = [] // Structure to hold data compatible with old logic

		try {
			const validationResult = XMLValidator.validate(replace_file_xml_str)
			if (validationResult !== true)
				throw new Error(`Invalid XML structure: ${validationResult.err.msg}`)

			parsedXml = parser.parse(replace_file_xml_str)

			if (parsedXml.file && Array.isArray(parsedXml.file))
				for (const fileNode of parsedXml.file) {
					if (!fileNode.path) {
						console.warn('Skipping <file> node without \'path\' attribute in replace-file XML.')
						continue
					}
					const fileData = {
						path: fileNode.path,
						replacements: []
					}
					if (fileNode.replacement && Array.isArray(fileNode.replacement))
						for (const repNode of fileNode.replacement) {
							if (repNode.search === undefined || repNode.replace === undefined) {
								console.warn('Skipping <replacement> node without <search> or <replace> tags in replace-file XML for path:', fileNode.path)
								continue
							}
							fileData.replacements.push({
								search: repNode.search,
								replace: repNode.replace,
								regex: repNode.regex
							})
						}
					else
						console.warn('No valid <replacement> array found for file:', fileNode.path)

					replace_files_data.push(fileData)
				}
			else
				console.warn('No valid <file> array found in <replace-file> XML.')


		} catch (err) {
			console.error('Error parsing replace-file XML:', err)
			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: `解析replace-file失败：\n\`\`\`\n${err}\n\`\`\`\n原始数据:\n<replace-file>${replace_file_xml_str}</replace-file>`,
				files: []
			})
			return true // Stop processing this command
		}

		// Check if we actually got data after parsing
		if (replace_files_data.length === 0) {
			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: `解析replace-file后未找到有效的文件替换操作。\n原始数据:\n<replace-file>${replace_file_xml_str}</replace-file>`,
				files: []
			})
			return true // Stop processing if no valid data
		}

		console.info('AI替换的文件：', replace_files_data)

		// --- Start of existing replacement logic (using replace_files_data) ---
		for (const replace_file of replace_files_data) {
			const { path, replacements } = replace_file
			const failed_replaces = []
			let replace_count = 0
			let originalContent
			try {
				originalContent = await fs.promises.readFile(resolvePath(path), 'utf-8')
			} catch (err) {
				AddLongTimeLog({
					name: 'system',
					role: 'system',
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
				} catch (err) {
					console.error(`Replacement failed for path ${path}, search "${search}", regex: ${regex}:`, err)
					failed_replaces.push({ ...rep, error: err.message || String(err) })
				}
			}

			let system_content = ''
			if (originalContent !== modifiedContent) {
				system_content = `文件 ${path} 内容已修改，应用了 ${replacements.length} 项替换`
				if (replace_count > 0) system_content += `，其中 ${replace_count} 个替换成功。\n`
				else system_content += '，但内容未发生实际变化。\n'
			} else
				system_content = `文件 ${path} 内容未发生变化（尝试了 ${replacements.length} 项替换规则）。\n`



			if (failed_replaces.length) {
				system_content += `以下 ${failed_replaces.length} 处替换操作失败：\n`
				system_content += '```json\n' + JSON.stringify(failed_replaces, null, '\t') + '\n```\n'
			}

			if (originalContent !== modifiedContent) {
				system_content += `\n最终文件内容：\n\`\`\`\n${modifiedContent}\n\`\`\`\n若和你的预期不一致，考虑重新替换或使用override-file覆写修正。`
				try {
					await fs.promises.writeFile(resolvePath(path), modifiedContent, 'utf-8')
				} catch (err) {
					system_content = `写入文件失败：${path}\n\`\`\`\n${err.stack}\n\`\`\`\n`
				}
			} else if (failed_replaces.length === 0)
				// If content didn't change AND no errors, explicitly state that
				system_content += '所有替换规则均未匹配到内容或未导致文件变化。'


			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: system_content,
				files: []
			})
		}
		statisticDatas.toolUsage.fileOperations++
		regen = true
	}

	const override_file_match = result.content.match(/<override-file\s+path="(?<path>[^"]+)">(?<content>[^]*?)<\/override-file>/)?.groups
	if (override_file_match) {
		const { path, content } = override_file_match
		const logContent = `<override-file path="${path}">` + content + '</override-file>\n'
		if (!tool_calling_log.content) {
			tool_calling_log.content += logContent
			AddLongTimeLog(tool_calling_log)
		} else
			tool_calling_log.content += logContent

		console.info('AI写入的文件：', path, content)
		try {
			await fs.promises.writeFile(resolvePath(path), content.trim() + '\n', 'utf-8')
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
		statisticDatas.toolUsage.fileOperations++
		regen = true
	}

	return regen
}
