import process from 'node:process'
import util from 'node:util'
import { parse } from 'npm:acorn'
import { walk } from 'npm:estree-walker'
import { generate } from 'npm:astring'
import { builders } from 'npm:ast-types'
import { bash_exec_NATS, pwsh_exec_NATS } from '../../scripts/exec.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatLogEntry_t} result
 * @param {(entry: chatLogEntry_t) => void} addLongTimeLog
 * @returns {Promise<boolean>}
 */
export async function coderunner(result, { addLongTimeLog }) {
	result.extension.execed_codes ??= {}
	let jsrunner = result.content.match(/```run-js\n(?<code>[^]*)\n```/)?.groups?.code
	if (jsrunner) {
		addLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: '```run-js\n' + jsrunner + '\n```',
			files: []
		})
		console.info('AI运行的JS代码：', jsrunner)
		let coderesult
		try {
			// 使用 acorn 解析代码为 AST
			const ast = parse(jsrunner, {
				ecmaVersion: 'latest',
				sourceType: 'module',
			})
			// 使用 estree-walker 遍历 AST，并进行修改
			walk(ast, {
				enter(node, parent, prop, index) {
					if (
						node.type === 'Program' &&
						!node.body.some(n => n.type === 'ReturnStatement')
					) {
						// 如果没有 return 语句，则添加 return 语句
						const lastStatement = node.body[node.body.length - 1]
						if (lastStatement && lastStatement.type === 'ExpressionStatement')
							node.body[node.body.length - 1] = builders.returnStatement(
								lastStatement.expression,
							)
						else if (lastStatement && lastStatement.type === 'VariableDeclaration') {
							const lastDeclaration = lastStatement.declarations[lastStatement.declarations.length - 1]
							if (lastDeclaration.init)
								node.body.push(builders.returnStatement(lastDeclaration.id))
						}
					}
				},
			})

			// 将修改后的 AST 转换回代码
			const modifiedCode = generate(ast)
			// 使用 eval 执行修改后的代码
			coderesult = await eval(`(async () => {${modifiedCode}})()`)
		} catch (err) {
			coderesult = err
		}
		console.info('coderesult', coderesult)
		addLongTimeLog({
			name: 'system',
			role: 'system',
			content: '执行结果：\n' + util.inspect(coderesult),
			files: []
		})
		result.extension.execed_codes[jsrunner] = coderesult
		return true
	}
	if (process.platform === 'win32') {
		let pwshrunner = result.content.match(/```run-pwsh\n(?<code>[^]*)\n```/)?.groups?.code
		if (pwshrunner) {
			addLongTimeLog({
				name: '龙胆',
				role: 'char',
				content: '```run-pwsh\n' + pwshrunner + '\n```',
				files: []
			})
			console.info('AI运行的Powershell代码：', pwshrunner)
			pwshrunner = `&{\n${pwshrunner}\n} | Out-String -Width 65536`
			let pwshresult
			try { pwshresult = await pwsh_exec_NATS(pwshrunner) } catch (err) { pwshresult = err }
			console.info('pwshresult', pwshresult)
			addLongTimeLog({
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
		let bashrunner = result.content.match(/```run-bash\n(?<code>[^]*)\n```/)?.groups?.code
		if (bashrunner) {
			addLongTimeLog({
				name: '龙胆',
				role: 'char',
				content: '```run-bash\n' + bashrunner + '\n```',
				files: []
			})
			console.info('AI运行的Bash代码：', bashrunner)
			let bashresult
			try { bashresult = await bash_exec_NATS(bashrunner) } catch (err) { bashresult = err }
			console.info('bashresult', bashresult)
			addLongTimeLog({
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
