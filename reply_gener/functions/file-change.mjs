import fs from 'node:fs'
import { homedir } from 'node:os'
import { escapeRegExp, parseRegexFromString } from '../../scripts/tools.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export async function file_change(result, { AddLongTimeLog }) {
	const view_files = result.content.match(/```view-file\n(?<paths>([^\n]*\n)+)```/)?.groups?.paths
	if (view_files) {
		const paths = view_files.split('\n').filter(path => path)
		if (paths.length) {
			AddLongTimeLog({
				name: '龙胆',
				role: 'char',
				content: '```view-file\n' + paths.join('\n') + '\n```',
				files: []
			})
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
		return true
	}
	const replace_file = result.content.match(/```replace-file (?<path>[^\n]+)\n(?<replaceBlocks>(?:```search(?<is_regex>-regex)?\n(?<search>[^]+?)\n```\n```replace\n(?<content>[^]*?)\n```\n)+)```/)?.groups
	if (replace_file) {
		const { path, replaceBlocks } = replace_file
		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: '````replace-file ' + path + '\n' + replaceBlocks + '\n````',
			files: []
		})
		console.info('AI替换的文件：', path, replaceBlocks)
		const failed_replaces = []
		const replaceRegex = /```search(?<is_regex>-regex)?\n(?<search>[^]+?)\n```\n```replace\n(?<content>[^]*?)\n/g
		let match
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
			return true
		}
		let modifiedContent = originalContent
		while ((match = replaceRegex.exec(replaceBlocks)) !== null) {
			const { search, content, is_regex } = match.groups
			try {
				const replaceRegex = is_regex ? parseRegexFromString(search) : new RegExp(escapeRegExp(search), 'gu')
				modifiedContent = modifiedContent.replace(replaceRegex, content)
				replace_count++
			} catch (err) {
				failed_replaces.push({ search, content, error: err })
			}
		}
		let system_content
		if(originalContent != modifiedContent)
			system_content = `文件 ${path} 完成 ${replace_count} 处替换。\n`
		else
			system_content = `文件 ${path} 没有任何替换。\n`
		if (failed_replaces.length) {
			system_content += `以下 ${failed_replaces.length} 处替换失败：\n`
			for (const replace of failed_replaces) {
				system_content += `\`\`\`search\n${replace.search}\n\`\`\`\n`
				if (replace.error)
					system_content += `\`\`\`\n${replace.error.stack}\n\`\`\`\n`
			}
		}
		if(originalContent != modifiedContent)
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
		return true
	}
	const override_file = result.content.match(/```override-file (?<path>[^\n]+)\n(?<content>[^]*)\n```/)?.groups
	if (override_file) {
		const { path, content } = override_file
		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: '```override-file ' + path + '\n' + content + '\n```',
			files: []
		})
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
		return true
	}

	return false
}
