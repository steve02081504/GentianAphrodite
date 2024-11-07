import { exec } from '../../../../../../../src/server/exec.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

function removeTerminalSequences(str) {
	return str.replace(/\x1B\[[\d;]*[Km]/g, '')
}

/**
 * @param {chatLogEntry_t} result
 * @param {(entry: chatLogEntry_t) => void} addLongTimeLog
 * @returns {Promise<boolean>}
 */
export async function coderunner(result, addLongTimeLog) {
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
		try { pwshresult = await exec(pwshrunner, { 'shell': 'pwsh.exe' }) } catch (err) { pwshresult = err }
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

	return false
}
