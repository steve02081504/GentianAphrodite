/**
 * @typedef {import('../../../../../../../src/decl/pluginAPI.ts').ReplyHandler_t} ReplyHandler_t
 */

import fs from 'node:fs'
import path from 'node:path'

/** @type {ReplyHandler_t} */
export function CharGenerator(reply, { AddLongTimeLog }) {
	const match_generator_tool = reply.content.match(/<generate-char\s+name="(?<charname>[^"]+)">\s*(?<code>[^]*?)\s*<\/generate-char>/)
	if (match_generator_tool) try {
		let { charname, code } = match_generator_tool.groups
		charname = charname.trim()
		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: `<generate-char name="${charname}">\n${code}\n</generate-char>`,
		})
		const dir = path.join(import.meta.dirname, '../../../', charname)
		const file = path.join(dir, 'main.mjs')
		if (fs.existsSync(file))
			throw new Error('无法覆盖已存在的角色')
		fs.mkdirSync(dir, { recursive: true })
		fs.writeFileSync(file, code)
		fs.writeFileSync(path.join(dir, 'fount.json'), JSON.stringify({
			type: 'chars',
			dirname: charname
		}, null, '\t'))

		AddLongTimeLog({
			name: 'char-generator',
			role: 'tool',
			content: `\
生成角色${charname}成功！
目录是${dir}
你可以在此基础上用文件编辑进一步调整或告知主人。
`,
		})

		return true
	}
	catch (e) {
		AddLongTimeLog({
			name: 'char-generator',
			role: 'tool',
			content: `生成失败！\n原因：${e.stack}`,
		})
		return true
	}

	return false
}

/** @type {ReplyHandler_t} */
export function PersonaGenerator(reply, { AddLongTimeLog }) {
	const match_generator_tool = reply.content.match(/<generate-persona\s+name="(?<charname>[^"]+)">\s*(?<code>[^]*?)\s*<\/generate-persona>/)
	if (match_generator_tool) try {
		let { charname, code } = match_generator_tool.groups
		charname = charname.trim()
		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: `<generate-persona name="${charname}">\n${code}\n</generate-persona>`,
		})
		const dir = path.join(import.meta.dirname, '../../../', '..', 'personas', charname)
		const file = path.join(dir, 'main.mjs')
		if (fs.existsSync(file))
			throw new Error('无法覆盖已存在的用户人设')
		fs.mkdirSync(dir, { recursive: true })
		fs.writeFileSync(file, code)
		fs.writeFileSync(path.join(dir, 'fount.json'), JSON.stringify({
			type: 'personas',
			dirname: charname
		}, null, '\t'))

		AddLongTimeLog({
			name: 'persona-generator',
			role: 'tool',
			content: `\
生成用户人设${charname}成功！
你可以在此基础上用文件编辑进一步调整或告知用户。
`,
		})

		return true
	}
	catch (e) {
		AddLongTimeLog({
			name: 'persona-generator',
			role: 'tool',
			content: `生成失败！\n原因：${e.stack}`,
		})
		return true
	}

	return false
}
