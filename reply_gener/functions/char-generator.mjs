/**
 * 角色生成器提示函数
 * @typedef {import('../../../../../../../src/decl/pluginAPI.ts').ReplyHandler_t} ReplyHandler_t
 */

import fs from 'node:fs'
import path from 'node:path'

import { defineReplyHandler } from '../../../../../../../src/public/parts/shells/chat/src/reply/defineReplyHandler.mjs'

/**
 * 处理 `<generate-char>`：将内层代码写成新的单文件角色。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {Function} args.AddLongTimeLog 追加工具结果日志
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function charGeneratorHandle(reply, args, call) {
	const AddLongTimeLog = args.AddLongTimeLog
	const charname = call.params.name.trim()
	const code = call.inner.trim()
	try {
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

		return { regen: true }
	}
	catch (e) {
		AddLongTimeLog({
			name: 'char-generator',
			role: 'tool',
			content: `生成失败！\n原因：${e.stack}`,
		})
		return { regen: true }
	}
}

/**
 * 处理 `<generate-persona>`：将内层代码写成新的单文件用户人设。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {Function} args.AddLongTimeLog 追加工具结果日志
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function personaGeneratorHandle(reply, args, call) {
	const AddLongTimeLog = args.AddLongTimeLog
	const charname = call.params.name.trim()
	const code = call.inner.trim()
	try {
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

		return { regen: true }
	}
	catch (e) {
		AddLongTimeLog({
			name: 'persona-generator',
			role: 'tool',
			content: `生成失败！\n原因：${e.stack}`,
		})
		return { regen: true }
	}
}

/** @type {ReplyHandler_t} */
export const CharGenerator = defineReplyHandler({
	tag: 'generate-char',
	params: { name: 'string' },
	handle: charGeneratorHandle,
})

/** @type {ReplyHandler_t} */
export const PersonaGenerator = defineReplyHandler({
	tag: 'generate-persona',
	params: { name: 'string' },
	handle: personaGeneratorHandle,
})
