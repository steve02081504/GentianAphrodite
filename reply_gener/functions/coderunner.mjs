import process from 'node:process'
import util from 'node:util'
import { bash_exec_NATS, pwsh_exec_NATS } from '../../scripts/exec.mjs'
import { async_eval } from '../../scripts/async_eval.mjs'
import { GetReply } from '../index.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export async function coderunner(result, args) {
	const { AddLongTimeLog } = args
	result.extension.execed_codes ??= {}
	const jsrunner = result.content.match(/<run-js>(?<code>[^]*?)<\/run-js>/)?.groups?.code
	if (jsrunner) {
		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: '<run-js>' + jsrunner + '</run-js>',
			files: []
		})
		console.info('AI运行的JS代码：', jsrunner)
		const coderesult = await async_eval(jsrunner, {
			callback: args.supported_functions.add_message ? async (reason, result) => {
				result = await result // 避免AI有时犯傻
				let logger = AddChatLogEntry
				const feedback = {
					name: 'system',
					role: 'system',
					content: `\
你的js代码中的callback函数被调用了
原因是：${reason}
你执行的代码是：
\`\`\`js
${jsrunner}
\`\`\`
result是：${util.inspect(result, { depth: 4 })}
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
					reply.logContextBefore = [feedback]
					logger(reply)
				}
				catch (error) {
					console.error(`Error processing callback for "${reason}":`, error)
					feedback.content += `处理callback时出错：${error.message}\n`
					logger(feedback)
				}
			} : undefined,
		})
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

	return false
}
