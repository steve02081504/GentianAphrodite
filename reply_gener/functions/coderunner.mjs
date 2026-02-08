import { Buffer } from 'node:buffer'
import util from 'node:util'

import { async_eval } from 'https://cdn.jsdelivr.net/gh/steve02081504/async-eval/deno.mjs'
import { available, shell_exec_map } from 'npm:@steve02081504/exec'

import { defineInlineToolUses } from '../../../../../../../src/public/parts/shells/chat/src/stream.mjs'
import { unlockAchievement } from '../../scripts/achievements.mjs'
import { toFileObj } from '../../scripts/fileobj.mjs'
import { newCharReply, statisticDatas } from '../../scripts/statistics.mjs'
import { captureScreen, sleep } from '../../scripts/tools.mjs'
import { GetReply } from '../index.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * 处理被执行代码的回调。
 * @param {object} args - 来自原始回复处理程序的参数。
 * @param {string} reason - 回调的原因。
 * @param {string} code - 被执行的代码。
 * @param {any} result - 回调的结果。
 */
async function callback_handler(args, reason, code, result) {
	let logger = args.AddChatLogEntry
	const feedback = {
		role: 'tool',
		name: 'coderunner.callback',
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
		if (!reply) return
		reply.logContextBefore.push(feedback)
		await logger({ name: '龙胆', ...reply })
		newCharReply(reply.content, args.extension?.platform || 'chat')
	}
	catch (error) {
		console.error(`Error processing callback for "${reason}":`, error)
		feedback.content += `处理callback时出错：${error.stack}\n`
		logger(feedback)
	}
}

/**
 * 处理来自 AI 的代码执行请求。
 * @param {prompt_struct_t} result - 包含AI回复内容和扩展信息的对象。
 * @param {object} args - 包含处理回复所需参数的对象。
 * @type {import("../../../../../../../src/decl/pluginAPI.ts").ReplyHandler_t}
 */
export async function coderunner(result, args) {
	const { AddLongTimeLog } = args
	result.extension.execed_codes ??= {}
	/**
	 * 获取 JS 代码执行的上下文。
	 * @param {string} code - 要执行的代码。
	 * @returns {Promise<object>} - 返回 JS 代码执行的上下文。
	 */
	async function get_js_eval_context(code) {
		const js_eval_context = {
			workspace: args.chat_scoped_char_memory.coderunner_workspace ??= {},
			chat_log: args.chat_log,
		}
		/**
		 * 清空工作区。
		 */
		function clear_workspace() {
			js_eval_context.workspace = args.chat_scoped_char_memory.coderunner_workspace = {}
			js_eval_context.workspace.clear = clear_workspace
		}
		js_eval_context.clear_workspace = clear_workspace
		if (args.supported_functions.add_message)
			/**
			 * @param {string} reason - 回调原因。
			 * @param {Promise<any>} promise - 相关的 Promise 对象。
			 * @returns {void}
			 */
			js_eval_context.callback = (reason, promise) => {
				if (!js_eval_context.eval_result && !(promise instanceof Promise))
					throw new Error('callback函数的第二个参数必须是一个Promise对象')
				/**
				 *
				 * @param {any} _ - 占位符参数。
				 * @returns {void}
				 */
				const _ = _ => callback_handler(args, reason, code, _)
				Promise.resolve(promise).then(_, _)
				return 'callback已注册'
			}
		const view_files = []
		let view_files_flag = false
		/**
		 *
		 * @param {...any} pathOrFileObjs - 文件路径或文件对象。
		 * @returns {Promise<void>}
		 */
		js_eval_context.view_files = async (...pathOrFileObjs) => {
			const errors = []
			for (const pathOrFileObj of pathOrFileObjs) try {
				view_files.push(await toFileObj(pathOrFileObj))
			} catch (e) { errors.push(e) }
			if (!view_files_flag)
				AddLongTimeLog(view_files_flag = {
					role: 'tool',
					name: 'coderunner.view_files',
					content: '你需要查看的文件在此。',
					files: view_files
				})
			if (errors.length == 1) throw errors[0]
			if (errors.length) throw errors
			return '文件已查看'
		}
		let sent_files
		if (args.supported_functions.files)
			/**
			 * 在eval时添加文件
			 * @param {...any} pathOrFileObjs - 文件路径或文件对象。
			 * @returns {Promise<void>}
			 */
			js_eval_context.add_files = async (...pathOrFileObjs) => {
				const errors = []
				for (const pathOrFileObj of pathOrFileObjs) try {
					result.files.push(await toFileObj(pathOrFileObj))
				} catch (e) { errors.push(e) }
				if (!sent_files)
					AddLongTimeLog(sent_files = {
						role: 'tool',
						name: 'coderunner.add_files',
						content: '文件已发送，内容见附件。',
						files: result.files
					})
				if (errors.length == 1) throw errors[0]
				if (errors.length) throw errors
				return '文件已发送'
			}
		return Object.assign(js_eval_context, ...(await Promise.all(
			Object.values(args.plugins).map(plugin => plugin.interfaces?.chat?.GetJSCodeContext?.(args, args.prompt_struct))
		)).filter(Boolean))
	}
	/**
	 * 为 AI 运行 JS 代码。
	 * @param {string} code - 要运行的代码。
	 * @returns {Promise<any>} - 返回代码执行的结果。
	 */
	async function run_jscode_for_AI(code) {
		return async_eval(code, await get_js_eval_context(code))
	}
	/**
	 * 等待指定秒数后截屏。
	 * @param {number} delaySeconds - 截图前等待秒数；0 表示立即截图。
	 * @returns {Promise<{name: string, buffer: Buffer, mime_type: string}>} - 截图对象。
	 */
	async function waitAndCapture(delaySeconds) {
		await sleep(delaySeconds * 1000)
		try {
			return { name: 'screenshot.png', buffer: await captureScreen(), mime_type: 'image/png' }
		} catch (e) {
			console.error(e)
			return { name: 'error.log', buffer: Buffer.from(`Error: ${e.stack}`), mime_type: 'text/plain' }
		}
	}

	// 将 run-* 与 wait-screen 作为平级步骤，按在 content 中的出现顺序排列
	const steps = []
	for (const m of result.content.matchAll(/<run-js>(?<code>[^]*?)<\/run-js>/g))
		steps.push({ index: m.index, type: 'run', runType: 'js', code: m.groups.code, fullText: m[0] })
	for (const shell_name in shell_exec_map) {
		if (!available[shell_name]) continue
		const re = new RegExp(`<run-${shell_name}>(?<code>[^]*?)<\\/run-${shell_name}>`, 'g')
		for (const m of result.content.matchAll(re))
			steps.push({ index: m.index, type: 'run', runType: shell_name, code: m.groups.code, fullText: m[0] })
	}
	for (const m of result.content.matchAll(/<wait-screen>(?<timeout>\d*?)<\/wait-screen>/g))
		steps.push({ index: m.index, type: 'wait-screen', timeout: Number(m.groups?.timeout?.trim?.() || 0) })
	steps.sort((a, b) => a.index - b.index)

	let processed = false
	if (steps.some(s => s.type === 'run'))
		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: steps.map(s => s.type === 'run' ? s.fullText : `<wait-screen>${s.timeout}</wait-screen>`).join('\n'),
			files: []
		})

	// 严格按步骤顺序执行：run 执行后推入工具消息；若下一步是 wait-screen 则等待截屏并推入**上一个**工具消息的 files
	for (let i = 0; i < steps.length; i++) {
		const step = steps[i]
		const toolEntry = {
			name: 'coderunner',
			role: 'tool',
			content: '',
			files: []
		}
		if (step.type === 'wait-screen') {
			const screenshot = await waitAndCapture(step.timeout)
			toolEntry.files.push(screenshot)
			continue
		}
		else {
			unlockAchievement('use_coderunner')
			statisticDatas.toolUsage.codeRuns++
		}
		if (step.runType === 'js') {
			console.info('AI运行的JS代码：', step.code)
			const coderesult = await run_jscode_for_AI(step.code)
			console.info('coderesult', coderesult)
			toolEntry.content = '执行结果：\n' + util.inspect(coderesult, { depth: 4 })
			result.extension.execed_codes[step.code] = coderesult
		}
		else {
			const shell_name = step.runType
			console.info(`AI运行的${shell_name}代码：`, step.code)
			let shell_result
			try { shell_result = await shell_exec_map[shell_name](step.code, { no_ansi_terminal_sequences: true }) } catch (err) { shell_result = err }
			result.extension.execed_codes[step.code] = shell_result
			if (shell_result.stdall) {
				shell_result = { ...shell_result };  for (const key of ['stdout', 'stderr']) delete shell_result[key]
			}
			console.info(`${shell_name} result`, shell_result)
			toolEntry.content = '执行结果：\n' + util.inspect(shell_result)
		}
		AddLongTimeLog(toolEntry)
		let next
		while ((next = steps[i + 1])?.type === 'wait-screen') {
			const screenshot = await waitAndCapture(next.timeout)
			toolEntry.files.push(screenshot)
			i++ // 已消费该 wait-screen
		}
		processed = true
	}

	// inline js code
	// 这个和其他的不一样，我们需要执行js代码并将结果以string替换代码块
	if (result.content.match(/<inline-js>[^]*?<\/inline-js>/)) try {
		unlockAchievement('use_coderunner')
		const original = result.content
		const cachedResults = args.extension.streamInlineToolsResults?.['inline-js']

		let replacements
		if (cachedResults?.length)
			replacements = cachedResults.map(res => {
				if (res instanceof Error) throw res
				return res
			})
		else
			// 古法计算
			replacements = await Promise.all(
				Array.from(result.content.matchAll(/<inline-js>(?<code>[^]*?)<\/inline-js>/g))
					.map(async match => {
						const jsrunner = match.groups.code
						console.info('AI内联运行的JS代码：', jsrunner)
						const coderesult = await run_jscode_for_AI(jsrunner)
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
		processed = true
	}

	for (const shell_name in shell_exec_map) {
		if (!available[shell_name]) continue
		const runner_regex = new RegExp(`<inline-${shell_name}>[^]*?<\\/inline-${shell_name}>`)
		if (result.content.match(runner_regex)) try {
			unlockAchievement('use_coderunner')
			const original = result.content
			const cachedResults = args.extension.streamInlineToolsResults?.[`inline-${shell_name}`]

			let replacements
			if (cachedResults?.length)
				replacements = cachedResults.map(res => {
					if (res instanceof Error) throw res
					return res
				})
			else {
				// 古法计算
				const runner_regex_g = new RegExp(`<inline-${shell_name}>(?<code>[^]*?)<\\/inline-${shell_name}>`, 'g')
				replacements = await Promise.all(
					Array.from(result.content.matchAll(runner_regex_g))
						.map(async match => {
							const runner = match.groups.code
							console.info(`AI内联运行的${shell_name}代码：`, runner)
							let shell_result
							try {
								shell_result = await shell_exec_map[shell_name](runner, { no_ansi_terminal_sequences: true })
							} catch (err) {
								shell_result = err
							}

							if (shell_result instanceof Error) throw shell_result

							if (shell_result.code)
								throw new Error(`${shell_name} execution of code '${runner}' failed with exit code ${shell_result.exitCode}:\n${util.inspect(shell_result)}`)

							return shell_result.stdout.trim()
						})
				)
			}

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
				content: `内联${shell_name}代码执行和替换完毕\n`,
				files: [],
				charVisibility: [args.char_id],
			})
			const runner_regex_g = new RegExp(`<inline-${shell_name}>(?<code>[^]*?)<\\/inline-${shell_name}>`, 'g')
			result.content = result.content.replace(runner_regex_g, () => replacements[i++])
		}
		catch (error) {
			console.error(`内联${shell_name}代码执行失败：`, error)
			AddLongTimeLog({
				name: '龙胆',
				role: 'char',
				content: result.content,
				files: result.files,
			})
			AddLongTimeLog({
				name: 'coderunner',
				role: 'tool',
				content: `内联${shell_name}代码执行失败：\n` + error.stack,
				files: []
			})
			processed = true
		}
	}

	return processed
}

/**
 * 获取代码运行器的预览更新器。
 * @returns {import("../../../../../../../src/decl/pluginAPI.ts").GetReplyPreviewUpdater_t} - 预览更新器获取器。
 */
export async function GetCoderunnerPreviewUpdater() {
	const toolDefs = [
		['inline-js', '<inline-js>', '</inline-js>', async (code) => {
			const jsrunner = code
			const coderesult = await async_eval(jsrunner, {})
			if (coderesult.error) throw coderesult.error
			return coderesult.result + ''
		}]
	]

	// 添加所有可用的 shell 内联工具
	for (const shell_name in shell_exec_map) {
		if (!available[shell_name]) continue
		toolDefs.push([
			`inline-${shell_name}`,
			`<inline-${shell_name}>`,
			`</inline-${shell_name}>`,
			async (code) => {
				const runner = code
				let shell_result
				try {
					shell_result = await shell_exec_map[shell_name](runner, { no_ansi_terminal_sequences: true })
				} catch (err) {
					shell_result = err
				}

				if (shell_result instanceof Error) throw shell_result

				if (shell_result.code)
					throw new Error(`${shell_name} execution of code '${runner}' failed with exit code ${shell_result.exitCode}`)

				return shell_result.stdout.trim()
			}
		])
	}

	return defineInlineToolUses(toolDefs)
}
