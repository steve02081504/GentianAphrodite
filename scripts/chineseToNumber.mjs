import { bigfloat } from 'npm:@steve02081504/bigfloat'

import { escapeRegExp } from './tools.mjs'

const NumberMap = {
	零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
	壹: 1, 贰: 2, 叁: 3, 肆: 4, 伍: 5, 陆: 6, 柒: 7, 捌: 8, 玖: 9,
	两: 2, 廿: 20, 卅: 30, 卌: 40, 半: 0.5,
}

const UnitMap = {
	坤: 2.5, // 基尼太美！
	十: 10, 拾: 10, 百: 100, 佰: 100, 皕: 200, 千: 1000, 仟: 1000, 万: 10000, 萬: 10000, 亿: 100000000, 億: 100000000,
	吉: 10n ** 9n, 兆: 10n ** 12n, 拍: 10n ** 15n, 京: 10n ** 16n, 艾: 10n ** 18n, 垓: 10n ** 20n, 皆: 10n ** 21n,
	佑: 10n ** 24n, 秭: 10n ** 24n, 罗: 10n ** 27n, 穰: 10n ** 28n, 昆: 10n ** 30n, 沟: 10n ** 32n, 涧: 10n ** 36n,
	正: 10n ** 40n, 载: 10n ** 44n, 极: 10n ** 48n,
}

const OperatorMap = {
	加上个: '+', 减去个: '-', 加个: '+', 减个: '-', 乘以个: '*', 除以个: '/', 乘个: '*', 除个: '/', 幂个: '**',
	加上: '+', 减去: '-', 加: '+', 减: '-', 乘以: '*', 除以: '/', 乘: '*', 除: '/', 幂: '**',
	大于等于: '>=', 小于等于: '<=', 等于: '==', 不等于: '!=', 大于: '>', 小于: '<',
	与: '&&', 或: '||', 非: '!',
	负的: '-', 负: '-',
	'（': '(', '）': ')', '【': '[', '】': ']',
	'×': '*', '÷': '/', '–': '-',
}
const NormalExprRegex = new RegExp(`^[\\d${Object.values(OperatorMap).map(escapeRegExp).join('')}]+$`, 'u')
// BaseNumberRegex可以正确处理阿拉伯数字
const BaseNumberRegex = new RegExp(`[\\d${Object.keys(NumberMap).map(escapeRegExp).join('')}]`, 'u')
const UnitRegex = new RegExp(`[${Object.keys(UnitMap).map(escapeRegExp).join('')}]`, 'u')
const DotRegex = new RegExp('[\\.点]', 'u')
const DotOrBaseNumberRegex = new RegExp(`${BaseNumberRegex.source}${DotRegex.source}+`.replaceAll('][', ''), 'u')
const NumberRegex = new RegExp(`${BaseNumberRegex.source}${UnitRegex.source}${DotRegex.source}+`.replaceAll('][', ''), 'u')
const OperatorRuleWords = [
	'的', '次方', '次幂', '倍', '分之', '比', '倍'
]
const BaseOperatorRegex = new RegExp(Object.keys(OperatorMap).concat(Object.values(OperatorMap)).map(escapeRegExp).join('|'), 'u')
const SimpleOperatorRegex = new RegExp(`${OperatorRuleWords.map(escapeRegExp).join('|')}|${BaseOperatorRegex.source}`, 'u')
const SimpleExprRegex = new RegExp(`(${NumberRegex.source}|${SimpleOperatorRegex.source})+`, 'u')
/**
 * 将中文表达式中的特殊规则转换为阿拉伯数字表达式中的运算符
 * @type {Record<RegExp, (match: RegExpMatchArray) => string>}
 */
const OperatorRuleMap = new Map([
	[new RegExp(`的(?<num>${SimpleExprRegex.source})次方`, 'u'), groups => '**' + (groups?.num || 2)],
	[new RegExp(`的(?<num>${SimpleExprRegex.source})次幂`, 'u'), groups => '**' + (groups?.num || 2)],
	[new RegExp(`的(?<num>${SimpleExprRegex.source})倍`, 'u'), groups => '*' + (groups?.num || 2)],
	[new RegExp(`(?<num1>${SimpleExprRegex.source})分之(?<num2>${SimpleExprRegex.source})`, 'u'), groups => '((' + groups.num2 + ')/(' + groups.num1 + '))'],
	[new RegExp(`(?<num1>${SimpleExprRegex.source})比(?<num2>${SimpleExprRegex.source})`, 'u'), groups => groups.num1 + '/' + groups.num2],
])
const OperatorRegex = new RegExp(`${BaseOperatorRegex.source}|${[...OperatorRuleMap.keys()].map(x => x.source).join('|')}`, 'u')
const ExprRegex = new RegExp(`(${NumberRegex.source}|${OperatorRegex.source})+`, 'u')

/**
 * 将包含中文数字的字符串转换为主要由阿拉伯数字组成的字符串。
 * 这个函数会处理常见的中文数字、单位以及一些特殊词（如“半”、“两”）。
 * 它能够处理整数、小数，以及与非数字字符混合的字符串。
 * @param {string} str - 包含中文数字的输入字符串。
 * @returns {string} - 转换后的字符串，其中中文数字被替换为阿拉伯数字。
 */
export function chineseToNumber(str) {
	for (const Number of Object.keys(NumberMap))
		str = str.replaceAll(Number, NumberMap[Number])

	str = str.replace(new RegExp(DotRegex.source, 'ug'), '.')

	let str_arr = [str]
	for (const Unit of Object.keys(UnitMap)) {
		const reg = new RegExp(`((\\d+(\\.\\d+)?(${Unit}|))|${Unit})`, 'u')
		// split str by Unit
		str_arr = str_arr.flatMap(s => {
			if (!s.includes(Unit)) return s
			const arr = []
			let match = null
			while (match = s.match(reg)) {
				arr.push(s.slice(0, match.index))
				arr.push(match[0])
				s = s.slice(match.index + match[0].length)
			}
			arr.push(s)
			return arr.filter(s => s)
		})
	}

	let last_slice = null, math_array = [], result = []
	/**
	 * 合并数学数组中的所有元素。
	 * @returns {bigfloat | null} 返回合并后的 bigfloat，如果数组为空则返回 null。
	 */
	function merge_math_array() {
		const result = [...math_array, last_slice].filter(s => s !== null).map(bigfloat).reduce((a, b) => (a || bigfloat(0)).add(b), null)
		math_array = []
		last_slice = null
		return result
	}
	for (const slice of str_arr) {
		let Unit = Object.keys(UnitMap).find(unit => slice.endsWith(unit))
		if (Unit) {
			let num = slice.slice(0, -Unit.length)
			if (!num && last_slice) {
				Unit = UnitMap[Unit]
				const arr = [...math_array, last_slice].filter(s => s !== null).map(bigfloat)
				const last_slice_arr = []
				while (arr.length && arr[arr.length - 1].lessThan(Unit))
					last_slice_arr.push(arr.pop())
				if (!last_slice_arr.length && arr.length) last_slice_arr.push(arr.pop())
				last_slice = last_slice_arr.reduce((a, b) => a.add(b), bigfloat(0)).mul(Unit)
				math_array = arr
				continue
			}
			num = new bigfloat(num || 1).mul(UnitMap[Unit])
			if (last_slice === null)
				last_slice = num
			else
				if (last_slice.greaterThan(num)) {
					math_array.push(last_slice)
					last_slice = num
				}
				else
					last_slice = last_slice.mul(UnitMap[Unit]).add(num)
			continue
		}
		else if (slice.match(/^\d+(?:\.\d+)?$/)) {
			math_array.push(last_slice)
			last_slice = slice
		}
		else {
			result.push(merge_math_array())
			result.push(slice)
		}
	}
	result.push(merge_math_array())
	result = result.filter(s => s)
	return result.join('')
}

/**
 * 将包含中文数字和运算符的表达式字符串转换为纯阿拉伯数字和标准运算符的数学表达式。
 * 例如，“三加五” 会被转换为 “3+5”。
 * @param {string} str - 中文数学表达式字符串。
 * @returns {string} - 转换后的标准数学表达式字符串。
 */
export function chineseToExpr(str) {
	if (NormalExprRegex.test(str)) return str
	str = chineseToNumber(str)
	for (const Operator of Object.keys(OperatorMap))
		str = str.replaceAll(Operator, OperatorMap[Operator])
	for (const [rule, replace] of OperatorRuleMap)
		if (NormalExprRegex.test(str)) return str
		else str = str.replace(rule, (...args) => replace(args.pop()))
	return str
}

/**
 * 在给定的字符串中查找所有有效的中文数学表达式，并计算它们的值。
 * 该函数会忽略不含单位的纯数字。
 * @param {string} str - 要在其中搜索表达式的输入字符串。
 * @returns {Object.<string, bigfloat>} - 一个对象，其键是找到的中文表达式，值是它们对应的 `bigfloat` 计算结果。
 */
export function findChineseExprs(str) {
	const exprs = {}
	const match = str.match(new RegExp(ExprRegex.source, 'ug')) || []
	for (const expr of match) try {
		const num_expr = chineseToExpr(expr)
		if (num_expr.match(/^[\d.]*$/)) {
			if (new RegExp(`^(${DotOrBaseNumberRegex.source})+$`, 'u').test(expr)) continue // 跳过无单位的纯数字
			if (new RegExp(`^(${UnitRegex.source})+$`, 'u').test(expr)) continue // 跳过无数字的纯单位
		}
		exprs[expr] = bigfloat.eval(num_expr)
	} catch (error) { /* ignore any error */ }
	return exprs
}
/**
 * 在给定的字符串中查找所有有效的中文数学表达式和数字，并计算它们的值。
 * @param {string} str - 要在其中搜索表达式和数字的输入字符串。
 * @returns {Object.<string, bigfloat>} - 一个对象，其键是找到的中文表达式或数字，值是它们对应的 `bigfloat` 计算结果。
 */
export function findChineseExprsAndNumbers(str) {
	const exprs = {}
	const match = str.match(new RegExp(ExprRegex.source, 'ug')) || []
	for (const expr of match) try {
		const num_expr = chineseToExpr(expr)
		if (num_expr.match(/^[\d.]*$/))
			if (new RegExp(`^(${UnitRegex.source})+$`, 'u').test(expr)) continue // 跳过无数字的纯单位
		exprs[expr] = bigfloat.eval(num_expr)
	} catch (error) { /* ignore any error */ }
	return exprs
}
