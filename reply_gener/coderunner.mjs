import { exec } from '../../../../../../src/server/exec.mjs'
/** @typedef {import("../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

function removeTerminalSequences(str) {
	return str.replace(/\x1B\[[\d;]*[Km]/g, '')
}

/**
 * @param {chatLogEntry_t} result
 * @param {prompt_struct_t} prompt_struct
 * @returns {Promise<boolean>}
 */
export async function coderunner(result, prompt_struct) {
	result.extension.execed_codes ??= {}
	let jsrunner = result.content.match(/(\n|^)```run-js\n(?<code>[^]*)\n```/)?.groups?.code
	if (jsrunner) {
		prompt_struct.char_prompt.additional_chat_log.push({
			name: '龙胆',
			role: 'char',
			content: '```run-js\n' + jsrunner + '\n```',
			files: []
		})
		/*
		if (result.extension.execed_codes[jsrunner])
			prompt_struct.char_prompt.additional_chat_log.push({
				name: 'system',
				role: 'system',
				content: '你已经运行过JS代码：\n' + jsrunner + '\n**请根据运行结果生成回复而不是重复运行**',
				files: []
			})
		*/
		console.log('AI运行的JS代码：', jsrunner)
		let coderesult
		try { coderesult = eval(jsrunner) } catch (err) { coderesult = err }
		console.log('coderesult', coderesult)
		prompt_struct.char_prompt.additional_chat_log.push({
			name: 'system',
			role: 'system',
			content: '你运行了JS代码：\n' + jsrunner + '\n执行结果：\n' + coderesult,
			files: []
		})
		result.extension.execed_codes[jsrunner] = coderesult
		return true
	}
	let pwshrunner = result.content.match(/(\n|^)```run-pwsh\n(?<code>[^]*)\n```/)?.groups?.code
	if (pwshrunner) {
		prompt_struct.char_prompt.additional_chat_log.push({
			name: '龙胆',
			role: 'char',
			content: '```run-pwsh\n' + pwshrunner + '\n```',
			files: []
		})
		/*
		if (result.extension.execed_codes[pwshrunner])
			prompt_struct.char_prompt.additional_chat_log.push({
				name: 'system',
				role: 'system',
				content: '你已经运行过Powershell代码：\n' + pwshrunner + '\n**请根据运行结果生成回复而不是重复运行**',
				files: []
			})
		*/
		console.log('AI运行的Powershell代码：', pwshrunner)
		let pwshresult
		try { pwshresult = await exec(pwshrunner, { 'shell': 'pwsh.exe' }) } catch (err) { pwshresult = err }
		console.log('pwshresult', pwshresult)
		prompt_struct.char_prompt.additional_chat_log.push({
			name: 'system',
			role: 'system',
			content: '你运行了Powershell代码：\n' + pwshrunner + '\n执行结果：\nstdout：\n' + removeTerminalSequences(pwshresult.stdout) + '\nstderr：\n' + removeTerminalSequences(pwshresult.stderr),
			files: []
		})
		result.extension.execed_codes[pwshrunner] = pwshresult
		return true
	}

	return false
}
