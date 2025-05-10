import process from 'node:process'
import util from 'node:util'
import { bash_exec_NATS, pwsh_exec_NATS } from '../../scripts/exec.mjs'
import { async_eval } from '../../scripts/async_eval.mjs'
import { GetReply } from '../index.mjs'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { Buffer } from 'node:buffer'
import { getFileExtFormMimetype, mimetypeFromBufferAndName } from '../../scripts/mimetype.mjs'
import { getUrlFilename } from '../../scripts/web.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

async function callback_handler(args, reason, code, result) {
	let logger = args.AddChatLogEntry
	const feedback = {
		name: 'system',
		role: 'system',
		content: `\
你的js代码中的callback函数被调用了
原因是：${reason}
你执行的代码是：
\`\`\`js
${code}
\`\`\`
结果是：${util.inspect(result, { depth: 4 })}
请根据callback函数的内容进行回复。
`,
		charVisibility: [args.char_id],
	}
	try {
		const new_req = args.Update()
		logger = new_req.AddChatLogEntry
		new_req.chat_log = [...new_req.chat_log, feedback]
		new_req.extension.from_callback = true
		const reply = await GetReply(new_req)
		reply.logContextBefore.push(feedback)
		logger(reply)
	}
	catch (error) {
		console.error(`Error processing callback for "${reason}":`, error)
		feedback.content += `处理callback时出错：${error.stack}\n`
		logger(feedback)
	}
}

function resolvePath(relativePath) {
	if (relativePath.startsWith('~'))
		return path.join(os.homedir(), relativePath.slice(1))
	return path.resolve(relativePath)
}

async function toFileObj(pathOrFileObj) {
	if (Object(pathOrFileObj) instanceof String)
		if (pathOrFileObj.startsWith('http://') || pathOrFileObj.startsWith('https://')) {
			const response = await fetch(pathOrFileObj)
			if (!response.ok) throw new Error('fetch failed.')
			const contentDisposition = response.headers.get('Content-Disposition')
			let name = getUrlFilename(pathOrFileObj, contentDisposition)
			const buffer = Buffer.from(await response.arrayBuffer())
			const mimeType = response.headers.get('content-type') || mimetypeFromBufferAndName(buffer, name || 'downloaded.bin')
			name ||= 'downloaded.' + (getFileExtFormMimetype(mimeType) || 'bin')
			pathOrFileObj = { name, buffer, mimeType }
		}
		else {
			const filePath = resolvePath(pathOrFileObj)
			const buffer = fs.readFileSync(filePath)
			const name = path.basename(filePath)
			pathOrFileObj = { name, buffer }
		}

	if (pathOrFileObj instanceof Object && 'name' in pathOrFileObj && 'buffer' in pathOrFileObj) {
		const buffer = Buffer.isBuffer(pathOrFileObj.buffer) ? pathOrFileObj.buffer : Buffer.from(pathOrFileObj.buffer)
		const mimeType = pathOrFileObj.mimeType || mimetypeFromBufferAndName(buffer, pathOrFileObj.name)
		return { name: pathOrFileObj.name, buffer, mimeType }
	}
	else
		throw new Error('无效的输入参数。期望为文件路径字符串、URL字符串或包含name和buffer属性的对象。')
}

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export async function coderunner(result, args) {
	const { AddLongTimeLog } = args
	result.extension.execed_codes ??= {}
	function get_js_eval_context(code) {
		const js_eval_context = {}
		if (args.supported_functions.add_message)
			/**
			 * @param {string} reason
			 * @param {Promise<any>} promise
			 */
			js_eval_context.callback = (reason, promise) => {
				const _ = _ => callback_handler(args, reason, code, _)
				promise.then(_, _)
				return 'callback已注册'
			}
		if (args.supported_functions.files)
			js_eval_context.add_files = async (...pathOrFileObjs) => {
				const errors = []
				for (const pathOrFileObj of pathOrFileObjs) try {
					result.files.push(await toFileObj(pathOrFileObj))
				} catch (e) {
					errors.push(e)
				}
				if (errors.length == 1) throw errors[0]
				if (errors.length) throw errors
				return '文件已发送'
			}
		return js_eval_context
	}

	const jsrunner = result.content.match(/<run-js>(?<code>[^]*?)<\/run-js>/)?.groups?.code?.split?.('<run-js>')?.pop?.()
	if (jsrunner) {
		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: '<run-js>' + jsrunner + '</run-js>',
			files: []
		})
		console.info('AI运行的JS代码：', jsrunner)
		const coderesult = await async_eval(jsrunner, get_js_eval_context(jsrunner))
		console.info('coderesult', coderesult)
		AddLongTimeLog({
			name: 'system',
			role: 'system',
			content: '执行结果：\n' + util.inspect(coderesult, { depth: 4 }),
			files: []
		})
		result.extension.execed_codes[jsrunner] = coderesult
		return true
	}
	if (process.platform === 'win32') {
		const pwshrunner = result.content.match(/<run-pwsh>(?<code>[^]*?)<\/run-pwsh>/)?.groups?.code
		if (pwshrunner) {
			AddLongTimeLog({
				name: '龙胆',
				role: 'char',
				content: '<run-pwsh>' + pwshrunner + '</run-pwsh>',
				files: []
			})
			console.info('AI运行的Powershell代码：', pwshrunner)
			let pwshresult
			try { pwshresult = await pwsh_exec_NATS(pwshrunner) } catch (err) { pwshresult = err }
			console.info('pwshresult', pwshresult)
			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: '执行结果：\n' + util.inspect(pwshresult),
				files: []
			})
			result.extension.execed_codes[pwshrunner] = pwshresult
			return true
		}
	}
	else {
		const bashrunner = result.content.match(/<run-bash>(?<code>[^]*?)<\/run-bash>/)?.groups?.code
		if (bashrunner) {
			AddLongTimeLog({
				name: '龙胆',
				role: 'char',
				content: '<run-bash>' + bashrunner + '</run-bash>',
				files: []
			})
			console.info('AI运行的Bash代码：', bashrunner)
			let bashresult
			try { bashresult = await bash_exec_NATS(bashrunner) } catch (err) { bashresult = err }
			console.info('bashresult', bashresult)
			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: '执行结果：\n' + util.inspect(bashresult),
				files: []
			})
			result.extension.execed_codes[bashrunner] = bashresult
			return true
		}
	}

	// inline js code
	// 这个和其他的不一样，我们需要执行js代码并将结果以string替换代码块
	if (result.content.match(/<inline-js>[^]*?<\/inline-js>/)) try {
		const original = result.content
		const replacements = await Promise.all(
			Array.from(result.content.matchAll(/<inline-js>(?<code>[^]*?)<\/inline-js>/g))
				.map(async match => {
					const jsrunner = match.groups.code.split('<inline-js>').pop()
					console.info('AI内联运行的JS代码：', jsrunner)
					const coderesult = await async_eval(jsrunner, get_js_eval_context(jsrunner))
					console.info('coderesult', coderesult)
					if (coderesult.error) throw coderesult.error
					return coderesult.result + ''
				})
		)
		let i = 0
		result.logContextBefore.push({
			name: '龙胆',
			role: 'char',
			content: original,
			files: result.files,
			charVisibility: [args.char_id],
		}, {
			name: 'system',
			role: 'system',
			content: '内联js代码执行和替换完毕\n',
			files: [],
			charVisibility: [args.char_id],
		})
		result.content = result.content.replace(/<inline-js>(?<code>[^]*?)<\/inline-js>/g, () => replacements[i++])
	}
	catch (error) {
		console.error('内联js代码执行失败：', error)
		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: result.content,
			files: result.files,
		})
		AddLongTimeLog({
			name: 'system',
			role: 'system',
			content: '内联js代码执行失败：\n' + error.stack,
			files: []
		})
		return true
	}

	return false
}
