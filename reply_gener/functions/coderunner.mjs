import { exec } from '../../../../../../../src/server/exec.mjs'
import process from 'node:process'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

function removeTerminalSequences(str) {
	// deno-lint-ignore no-control-regex
	return str.replace(/\x1B\[[\d;]*[Km]/g, '')
}

// if pwsh.exe available, use it, else use powershell.exe
let pwshavailable = Boolean(await exec('1', { 'shell': 'pwsh.exe' }).catch(() => false))

/**
 * @param {chatLogEntry_t} result
 * @param {(entry: chatLogEntry_t) => void} addLongTimeLog
 * @returns {Promise<boolean>}
 */
export async function coderunner(result, { addLongTimeLog }) {
	result.extension.execed_codes ??= {}
	let jsrunner = result.content.match(/(\n|^)```run-js\n(?<code>[^]*)\n```/)?.groups?.code
	if (jsrunner) {
		addLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: '```run-js\n' + jsrunner + '\n```',
			files: []
		})
		console.log('AI运行的JS代码：', jsrunner)
		let coderesult
		try { coderesult = eval(jsrunner) } catch (err) { coderesult = err }
		console.log('coderesult', coderesult)
		addLongTimeLog({
			name: 'system',
			role: 'system',
			content: '执行结果：\n' + coderesult,
			files: []
		})
		result.extension.execed_codes[jsrunner] = coderesult
		return true
	}
	if (process.platform === 'win32') {
		let pwshrunner = result.content.match(/(\n|^)```run-pwsh\n(?<code>[^]*)\n```/)?.groups?.code
		if (pwshrunner) {
			addLongTimeLog({
				name: '龙胆',
				role: 'char',
				content: '```run-pwsh\n' + pwshrunner + '\n```',
				files: []
			})
			console.log('AI运行的Powershell代码：', pwshrunner)
			let pwshresult
			try { pwshresult = await exec(pwshrunner, { 'shell': pwshavailable ? 'pwsh.exe' : 'powershell.exe' }) } catch (err) { pwshresult = err }
			console.log('pwshresult', pwshresult)
			addLongTimeLog({
				name: 'system',
				role: 'system',
				content: '执行结果：\nstdout：\n' + removeTerminalSequences(pwshresult.stdout) + '\nstderr：\n' + removeTerminalSequences(pwshresult.stderr),
				files: []
			})
			result.extension.execed_codes[pwshrunner] = pwshresult
			return true
		}
	}
	else {
		let bashrunner = result.content.match(/(\n|^)```run-bash\n(?<code>[^]*)\n```/)?.groups?.code
		if (bashrunner) {
			addLongTimeLog({
				name: '龙胆',
				role: 'char',
				content: '```run-bash\n' + bashrunner + '\n```',
				files: []
			})
			console.log('AI运行的Bash代码：', bashrunner)
			let bashresult
			try { bashresult = await exec(bashrunner, { 'shell': '/bin/bash' }) } catch (err) { bashresult = err }
			console.log('bashresult', bashresult)
			addLongTimeLog({
				name: 'system',
				role: 'system',
				content: '执行结果：\nstdout：\n' + removeTerminalSequences(bashresult.stdout) + '\nstderr：\n' + removeTerminalSequences(bashresult.stderr),
				files: []
			})
			result.extension.execed_codes[bashrunner] = bashresult
			return true
		}
	}

	return false
}