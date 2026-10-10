import path from 'node:path'

/**
 * 在 Rollup 分析和裁剪分支前注入分发标志及版本，不能等到 renderChunk。
 * @param {string} version 发布版本。
 * @param {string} [charBasePath] 角色基础模块的路径。
 * @returns {object} Rollup 插件。
 */
export function distFlagsPlugin(version, charBasePath = path.resolve('charbase.mjs')) {
	return {
		name: 'dist-flags-injector',
		/**
		 * 只替换 charbase 的声明初始化表达式，其他源码保持原样。
		 * @param {string} code 模块源码。
		 * @param {string} id 模块绝对路径。
		 * @returns {{code: string, map: null} | null} 转换结果。
		 */
		transform(code, id) {
			if (path.resolve(id) !== path.resolve(charBasePath)) return null
			const replacements = new Map([['is_dist', 'true'], ['charvar', JSON.stringify(version)]])
			const edits = []
			for (const statement of this.parse(code).body) {
				const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement
				if (declaration?.type !== 'VariableDeclaration') continue
				for (const variable of declaration.declarations) {
					if (!replacements.has(variable.id.name) || !variable.init) continue
					edits.push({ start: variable.init.start, end: variable.init.end, value: replacements.get(variable.id.name) })
					replacements.delete(variable.id.name)
				}
			}
			if (replacements.size) throw new Error(`Missing distribution declarations: ${[...replacements.keys()].join(', ')}`)
			for (const edit of edits.sort((a, b) => b.start - a.start))
				code = code.slice(0, edit.start) + edit.value + code.slice(edit.end)
			return { code, map: null }
		},
	}
}
