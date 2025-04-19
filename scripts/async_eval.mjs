import { parse } from 'npm:acorn'
import { walk } from 'npm:estree-walker'
import { generate } from 'npm:astring'
import { builders } from 'npm:ast-types'
import { VirtualConsole } from './virtualConsole.mjs'

/**
 * Asynchronously evaluates JavaScript code with optional arguments and a virtual console for output.
 *
 * @param {string} code - The JavaScript code to be evaluated.
 * @param {object} [args={}] - An optional object containing arguments to be used within the code.
 * @param {VirtualConsole} [virtualconsole=new VirtualConsole({ realConsoleOutput: true })] - An optional virtual console instance for capturing output.
 * @returns {Promise<{result?: any; output: string; error?: Error}>} A promise that resolves to an object containing either the result of the evaluation or an error if one occurred, along with any console output.
 */
export async function async_eval(code, args = {}, virtualconsole = new VirtualConsole({ realConsoleOutput: true })) {
	let coderesult
	try {
		const ast = parse(code, {
			ecmaVersion: 'latest',
			sourceType: 'module',
		})

		walk(ast, {
			enter(/** @type {import('npm:estree').Node} */ node, parent, prop, index) {
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
		const result = await eval(`\
(async () => {
	const { ${Object.keys(args).join(', ')} } = args
	${modifiedCode}
})()`)
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
	return coderesult
}
