import process from 'node:process'
import util from 'node:util'
import { parse } from 'npm:acorn'
import { walk } from 'npm:estree-walker'
import { generate } from 'npm:astring'
import { builders } from 'npm:ast-types'
import { bash_exec_NATS, pwsh_exec_NATS } from '../../scripts/exec.mjs'
import { VirtualConsole } from '../../scripts/virtualConsole.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export async function coderunner(result, { AddLongTimeLog }) {
	result.extension.execed_codes ??= {}
	const jsrunner = result.content.match(/```run-js\n(?<code>[^]*)\n```/)?.groups?.code
	if (jsrunner) {
		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: '```run-js\n' + jsrunner + '\n```',
			files: []
		})
		console.info('AI运行的JS代码：', jsrunner)
		let coderesult
		const virtualconsole = new VirtualConsole({ realConsoleOutput: true }) // 捕获输出
		try {
			const ast = parse(jsrunner, {
				ecmaVersion: 'latest',
				sourceType: 'module',
			})

			walk(ast, {
				enter(/** @type {import('estree').Node} */ node, parent, prop, index) {
					// 将 import xxx from 'module' 转换为 const { xxx } = await import('module')
					if (node.type === 'ImportDeclaration') {
						const dynamicImportCall = builders.awaitExpression(
							builders.callExpression(
								builders.identifier('import'),
								[node.source]
							)
						)

						if (node.specifiers && node.specifiers.length > 0) {
							let hasNamespace = false
							const properties = []

							for (const specifier of node.specifiers)
								if (specifier.type === 'ImportNamespaceSpecifier') {
									// import * as name from '...' => const name = await import('...')
									hasNamespace = true
									const declaration = builders.variableDeclaration('const', [
										builders.variableDeclarator(specifier.local, dynamicImportCall)
									])
									this.replace(declaration)
									break
								} else if (specifier.type === 'ImportDefaultSpecifier')
									// import defaultName from '...' => { default: defaultName }
									properties.push(
										builders.property(
											'init',
											builders.identifier('default'),
											specifier.local,
											false,
											false
										)
									)
								 else if (specifier.type === 'ImportSpecifier')
									// import { name } from '...' / import { name as alias } from '...' => { name } / { name: alias }
									properties.push(
										builders.property(
											'init',
											specifier.imported,
											specifier.local,
											specifier.imported.name === specifier.local.name,
											false
										)
									)

							if (!hasNamespace && properties.length > 0) {
								// const { default: D, X, Y: Z } = await import('...');
								const declaration = builders.variableDeclaration('const', [
									builders.variableDeclarator(
										builders.objectPattern(properties),
										dynamicImportCall
									)
								])
								this.replace(declaration)
							} else if (!hasNamespace && properties.length === 0) {
								// import {} from '...' => await import('...');
								const expressionStatement = builders.expressionStatement(dynamicImportCall)
								this.replace(expressionStatement)
							}
						} else {
							// import '...' => await import('...'); (Side effects)
							const expressionStatement = builders.expressionStatement(dynamicImportCall)
							this.replace(expressionStatement)
						}
					}
					// 添加隐式 return
					else if (
						node.type === 'Program' &&
						!node.body.some(n => n.type === 'ReturnStatement')
					) {
						const lastStatement = node.body[node.body.length - 1]
						switch (lastStatement.type) {
							case 'ExpressionStatement':
								// return a + b;
								node.body[node.body.length - 1] = builders.returnStatement(
									lastStatement.expression,
								)
								break
							case 'VariableDeclaration':
								// const a = 1; => const a = 1; return a;
								const lastDeclaration = lastStatement.declarations[lastStatement.declarations.length - 1]
								if (lastDeclaration.init && lastDeclaration.id.type === 'Identifier')
									node.body.push(builders.returnStatement(lastDeclaration.id))

								break
						}
					}
				},
			})

			const modifiedCode = generate(ast)
			const console = virtualconsole; console
			const result = await eval(`(async () => {${modifiedCode}})()`)
			coderesult = {
				result,
				output: virtualconsole.outputs
			}
		} catch (error) {
			coderesult = {
				error,
				output: virtualconsole.outputs
			}
		}
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
		let pwshrunner = result.content.match(/```run-pwsh\n(?<code>[^]*)\n```/)?.groups?.code
		if (pwshrunner) {
			AddLongTimeLog({
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
		const bashrunner = result.content.match(/```run-bash\n(?<code>[^]*)\n```/)?.groups?.code
		if (bashrunner) {
			AddLongTimeLog({
				name: '龙胆',
				role: 'char',
				content: '```run-bash\n' + bashrunner + '\n```',
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
