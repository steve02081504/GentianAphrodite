import { async_eval } from 'npm:@steve02081504/async-eval'

/**
 * 反转一个字符串。
 * @param {string} str - 要反转的字符串。
 * @returns {string} - 反转后的字符串。
 */
export function reverseStr(/** @type {string} */str) {
	return Array.from(str).reverse().join('')
}

/**
 * 匹配一个字符串中的所有 ${expr}，并将其替换为表达式的求值结果。
 * @param {string} str - 要格式化的字符串。
 * @param {Record<string, any>} formats - 一个包含表达式中可用变量的对象。
 * @returns {Promise<string>} - 格式化后的字符串。
 */
export async function FormatStr(str, formats) {
	// 使用循环匹配所有 ${...} 表达式
	let result = ''
	const errors = []
	while (str.indexOf('${') != -1) {
		const length = str.indexOf('${')
		result += str.slice(0, length)
		str = str.slice(length + 2)
		let end_index = 0
		let matched = false
		find: while (str.indexOf('}', end_index) != -1) { // 我们需要遍历所有的结束符直到表达式跑通
			end_index = str.indexOf('}', end_index) + 1
			const expression = str.slice(0, end_index - 1)
			try {
				const eval_result = await async_eval(expression, formats)
				if (eval_result.error) throw eval_result.error
				result += eval_result.result
				str = str.slice(end_index)
				errors.length = 0
				matched = true
				break find
			} catch (error) {
				errors.push(error)
			}
		}
		if (!matched) {
			errors.forEach(console.error)
			errors.length = 0
			result += `\${${str.slice(0, end_index || str.length)}`
			str = str.slice(end_index || str.length)
		}
	}
	result += str
	return result
}

/**
 * 转义 HTML 特殊字符。
 * @param {string} str - 要转义的字符串。
 * @returns {string} - 转义后的字符串。
 */
export function escapeHTML(str) {
	const htmlEntities = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		'\'': '&#39;'
	}
	return str.replace(/["&'<>]/g, match => htmlEntities[match])
}
