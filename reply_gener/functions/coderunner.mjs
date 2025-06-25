import process from 'node:process'
import util from 'node:util'
import { bash_exec, pwsh_exec } from '../../scripts/exec.mjs'
import { async_eval } from '../../scripts/async_eval.mjs'
import { GetReply } from '../index.mjs'
import { newCharReplay, statisticDatas } from '../../scripts/statistics.mjs'
import { captureScreen } from '../../scripts/tools.mjs'
import { toFileObj } from '../../scripts/fileobj.mjs'
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
你此前执行的代码是：
\`\`\`js
${code}
\`\`\`
结果是：${util.inspect(result, { depth: 4 })}
请根据callback函数的内容进行回复。
`,
		charVisibility: [args.char_id],
	}
	try {
		const new_req = await args.Update()
		logger = new_req.AddChatLogEntry
		new_req.chat_log = [...new_req.chat_log, feedback]
		new_req.extension.from_callback = true
		const reply = await GetReply(new_req)
		reply.logContextBefore.push(feedback)
		await logger(reply)
		newCharReplay(reply.content, args.extension?.platform || 'chat')
	}
	catch (error) {
		console.error(`Error processing callback for "${reason}":`, error)
		feedback.content += `处理callback时出错：${error.stack}\n`
		logger(feedback)
	}
}

/** @type {import("../../../../../../../src/decl/pluginAPI.ts").ReplyHandler_t} */
export async function coderunner(result, args) {
	const { AddLongTimeLog } = args
	result.extension.execed_codes ??= {}
	async function get_js_eval_context(code) {
		const js_eval_context = {
			workspace: args.chat_scoped_char_memory.coderunner_workspace ??= {},
			chat_log: args.chat_log,
		}
		function clear_workspace() {
			js_eval_context.workspace = args.chat_scoped_char_memory.coderunner_workspace = {}
			js_eval_context.workspace.clear = clear_workspace
		}
		js_eval_context.clear_workspace = clear_workspace
		if (args.supported_functions.add_message)
			/**
			 * @param {string} reason
			 * @param {Promise<any>} promise
			 */
			js_eval_context.callback = (reason, promise) => {
				if (!(promise instanceof Promise)) throw new Error('callback函数的第二个参数必须是一个Promise对象')
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
		return Object.assign(js_eval_context, ...(await Promise.all(
			Object.values(args.plugins).map(plugin => plugin.interfaces?.chat?.GetJSCodeContext?.(args, args.prompt_struct))
		)).filter(Boolean))
	}
	// 解析wait-screen
	const wait_screen = Number(result.content.match(/<wait-screen>(?<timeout>\d*?)<\/wait-screen>/)?.groups?.timeout?.trim?.() || 0)
	async function get_screen() {
		if (!wait_screen) return
		await new Promise(resolve => setTimeout(resolve, wait_screen * 1000))
		try {
			return { name: 'screenshot.png', buffer: await captureScreen(), mime_type: 'image/png' }
		}
		catch (e) {
			console.error(e)
			return { name: 'error.log', buffer: Buffer.from(`Error: ${e.stack}`), mime_type: 'text/plain' }
		}
	}

	const jsrunner = result.content.match(/<run-js>(?<code>[^]*?)<\/run-js>/)?.groups?.code?.split?.('<run-js>')?.pop?.()
	if (jsrunner) {
		statisticDatas.toolUsage.codeRuns++
		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: '<run-js>' + jsrunner + '</run-js>' + (wait_screen ? `\n<wait-screen>${wait_screen}</wait-screen>` : ''),
			files: []
		})
		console.info('AI运行的JS代码：', jsrunner)
		const coderesult = await async_eval(jsrunner, await get_js_eval_context(jsrunner))
		console.info('coderesult', coderesult)
		AddLongTimeLog({
			name: 'coderunner',
			role: 'tool',
			content: '执行结果：\n' + util.inspect(coderesult, { depth: 4 }),
			files: [await get_screen()].filter(Boolean)
		})
		result.extension.execed_codes[jsrunner] = coderesult
		return true
	}
	if (process.platform === 'win32') {
		const pwshrunner = result.content.match(/<run-pwsh>(?<code>[^]*?)<\/run-pwsh>/)?.groups?.code
		if (pwshrunner) {
			statisticDatas.toolUsage.codeRuns++
			AddLongTimeLog({
				name: '龙胆',
				role: 'char',
				content: '<run-pwsh>' + pwshrunner + '</run-pwsh>' + (wait_screen ? `\n<wait-screen>${wait_screen}</wait-screen>` : ''),
				files: []
			})
			console.info('AI运行的Powershell代码：', pwshrunner)
			let pwshresult
			try { pwshresult = await pwsh_exec(pwshrunner, { no_ansi_terminal_sequences: true }) } catch (err) { pwshresult = err }
			result.extension.execed_codes[pwshrunner] = pwshresult
			if (pwshresult.stdall) { pwshresult = { ...pwshresult }; delete pwshresult.stdout; delete pwshresult.stderr }
			console.info('pwshresult', pwshresult)
			AddLongTimeLog({
				name: 'coderunner',
				role: 'tool',
				content: '执行结果：\n' + util.inspect(pwshresult),
				files: [await get_screen()].filter(Boolean)
			})
			return true
		}
	}
	else {
		const bashrunner = result.content.match(/<run-bash>(?<code>[^]*?)<\/run-bash>/)?.groups?.code
		if (bashrunner) {
			statisticDatas.toolUsage.codeRuns++
			AddLongTimeLog({
				name: '龙胆',
				role: 'char',
				content: '<run-bash>' + bashrunner + '</run-bash>' + (wait_screen ? `\n<wait-screen>${wait_screen}</wait-screen>` : ''),
				files: []
			})
			console.info('AI运行的Bash代码：', bashrunner)
			let bashresult
			try { bashresult = await bash_exec(bashrunner, { no_ansi_terminal_sequences: true }) } catch (err) { bashresult = err }
			result.extension.execed_codes[bashrunner] = bashresult
			if (bashresult.stdall) { bashresult = { ...bashresult }; delete bashresult.stdout; delete bashresult.stderr }
			console.info('bashresult', bashresult)
			AddLongTimeLog({
				name: 'coderunner',
				role: 'tool',
				content: '执行结果：\n' + util.inspect(bashresult),
				files: [await get_screen()].filter(Boolean)
			})
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
					const coderesult = await async_eval(jsrunner, await get_js_eval_context(jsrunner))
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
			name: 'coderunner',
			role: 'tool',
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
			name: 'coderunner',
			role: 'tool',
			content: '内联js代码执行失败：\n' + error.stack,
			files: []
		})
		return true
	}

	return false
}
