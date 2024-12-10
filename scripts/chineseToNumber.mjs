import { bigfloat } from './bigfloat.mjs'
import { escapeRegExp } from './tools.mjs'

const NumberMap = {
	'零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
	'壹': 1, '贰': 2, '叁': 3, '肆': 4, '伍': 5, '陆': 6, '柒': 7, '捌': 8, '玖': 9,
	'两': 2, '廿': 20, '卅': 30, '卌': 40, '半': 0.5,
}

const UnitMap = {
	'坤': 2.5,
	'十': 10, '拾': 10, '百': 100, '佰': 100, '皕': 200, '千': 1000, '仟': 1000, '万': 10000, '萬': 10000, '亿': 100000000, '億': 100000000,
	'吉': 10n ** 9n, '兆': 10n ** 12n, '拍': 10n ** 15n, '京': 10n ** 16n, '艾': 10n ** 18n, '垓': 10n ** 20n, '皆': 10n ** 21n,
	'佑': 10n ** 24n, '秭': 10n ** 24n, '罗': 10n ** 27n, '穰': 10n ** 28n, '昆': 10n ** 30n, '沟': 10n ** 32n, '涧': 10n ** 36n,
	'正': 10n ** 40n, '载': 10n ** 44n, '极': 10n ** 48n,
}

const OperatorMap = {
	'加上个': '+', '减去个': '-', '加个': '+', '减个': '-', '乘以个': '*', '除以个': '/', '乘个': '*', '除个': '/', '幂个': '**',
	'加上': '+', '减去': '-', '加': '+', '减': '-', '乘以': '*', '除以': '/', '乘': '*', '除': '/', '幂': '**',
	'大于等于': '>=', '小于等于': '<=', '等于': '==', '不等于': '!=', '大于': '>', '小于': '<',
	'与': '&&', '或': '||', '非': '!',
	'负的': '-', '负': '-',
	'（': '(', '）': ')', '【': '[', '】': ']',
	'×': '*', '÷': '/', '–': '-',
}
let NormalExprRegex = new RegExp(`[\\d${Object.values(OperatorMap).map(escapeRegExp).join('')}]+`)
// BaseNumberRegex可以正确处理阿拉伯数字
let BaseNumberRegex = new RegExp(`[\\d${Object.keys(NumberMap).map(escapeRegExp).join('')}]`, 'u')
let UnitRegex = new RegExp(`[${Object.keys(UnitMap).map(escapeRegExp).join('')}]`, 'u')
let DotRegex = new RegExp('[\\.点]', 'u')
let DotOrBaseNumberRegex = new RegExp(`${BaseNumberRegex.source}${DotRegex.source}+`.replaceAll('][', ''), 'u')
let NumberRegex = new RegExp(`${BaseNumberRegex.source}${UnitRegex.source}${DotRegex.source}+`.replaceAll('][', ''), 'u')
let OperatorRuleWords = [
	'的', '次方', '次幂', '倍', '分之', '比', '倍'
]
let BaseOperatorRegex = new RegExp(Object.keys(OperatorMap).concat(Object.values(OperatorMap)).map(escapeRegExp).join('|'), 'u')
let SimpleOperatorRegex = new RegExp(`${OperatorRuleWords.map(escapeRegExp).join('|')}|${BaseOperatorRegex.source}`, 'u')
let SimpleExprRegex = new RegExp(`(${NumberRegex.source}|${SimpleOperatorRegex.source})+`, 'u')
/**
 * 将中文表达式中的特殊规则转换为阿拉伯数字表达式中的运算符
 * @type {Record<RegExp, (match: RegExpMatchArray) => string>}
 */
const OperatorRuleMap = new Map([
	[new RegExp(`的(?<num>${SimpleExprRegex.source})次方`, 'u'), (groups) => '**' + (groups?.num || 2)],
	[new RegExp(`的(?<num>${SimpleExprRegex.source})次幂`, 'u'), (groups) => '**' + (groups?.num || 2)],
	[new RegExp(`的(?<num>${SimpleExprRegex.source})倍`, 'u'), (groups) => '*' + (groups?.num || 2)],
	[new RegExp(`(?<num1>${SimpleExprRegex.source})分之(?<num2>${SimpleExprRegex.source})`, 'u'), (groups) => '((' + groups.num2 + ')/(' + groups.num1 + '))'],
	[new RegExp(`(?<num1>${SimpleExprRegex.source})比(?<num2>${SimpleExprRegex.source})`, 'u'), (groups) => groups.num1 + '/' + groups.num2],
])
let OperatorRegex = new RegExp(`${BaseOperatorRegex.source}|${[...OperatorRuleMap.keys()].map(x => x.source).join('|')}`, 'u')
let ExprRegex = new RegExp(`(${NumberRegex.source}|${OperatorRegex.source})+`, 'u')

/**
 * 将中文数字转换为阿拉伯数字
 * @param {string} str - 中文数字字符串，可能有其他字符混合
 * @returns {string} - 阿拉伯数字字符串，视输入可能包含其他字符
 */
export function chineseToNumber(str) {
	for (let Number of Object.keys(NumberMap))
		str = str.replaceAll(Number, NumberMap[Number])

	str = str.replace(new RegExp(DotRegex.source, 'ug'), '.')

	let str_arr = [str]
	for (let Unit of Object.keys(UnitMap)) {
		let reg = new RegExp(`(\\d+(\\.\\d+)?)*${Unit}`)
		// split str by Unit
		str_arr = str_arr.flatMap(s => {
			if (!s.includes(Unit)) return s
			let arr = []
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
	function marge_math_array() {
		let result = [...math_array, last_slice].filter(s => s !== null).map(bigfloat).reduce((a, b) => (a || bigfloat(0)).add(b), null)
		math_array = []
		last_slice = null
		return result
	}
	for (let slice of str_arr) {
		let Unit = Object.keys(UnitMap).find(unit => slice.endsWith(unit))
		if (Unit) {
			let num = slice.slice(0, -Unit.length)
			if (!num && last_slice) {
				Unit = UnitMap[Unit]
				let arr = [...math_array, last_slice].filter(s => s !== null).map(bigfloat)
				let last_slice_arr = []
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
		else if (slice.match(/^\d+(\.\d+)?$/)) {
			math_array.push(last_slice)
			last_slice = slice
		}
		else {
			result.push(marge_math_array())
			result.push(slice)
		}
	}
	result.push(marge_math_array())
	result = result.filter(s => s)
	return result.join('')
}

/**
 * 将中文表达式转换为阿拉伯数字表达式
 * @param {string} str - 中文表达式字符串
 * @returns {string} - 阿拉伯数字表达式字符串
 */
export function chineseToExpr(str) {
	if (NormalExprRegex.test(str)) return str
	str = chineseToNumber(str)
	for (let Operator of Object.keys(OperatorMap))
		str = str.replaceAll(Operator, OperatorMap[Operator])
	for (let [rule, replace] of OperatorRuleMap)
		str = str.replace(rule, (...args) => replace(args.pop()))
	return str
}

/**
 * 查找字符串中的中文表达式
 * @param {string} str - 字符串
 * @returns {Object.<string, bigfloat>} - 表达式及其对应的值
 */
export function findChineseExprs(str) {
	let exprs = {}
	let match = str.match(new RegExp(ExprRegex.source, 'ug')) || []
	for (let expr of match) try {
		let num_expr = chineseToExpr(expr)
		if (num_expr.match(/^[\d.]*$/)) {
			if (new RegExp(`^(${DotOrBaseNumberRegex.source})+$`, 'u').test(expr)) continue // 跳过无单位的纯数字
			if (new RegExp(`^(${UnitRegex.source})+$`, 'u').test(expr)) continue // 跳过无数字的纯单位
		}
		exprs[expr] = bigfloat.eval(num_expr)
	} catch (error) { }
	return exprs
}
/**
 * 查找字符串中的中文表达式和数字
 * @param {string} str - 字符串
 * @returns {Object.<string, bigfloat>} - 表达式及其对应的值
 */
export function findChineseExprsAndNumbers(str) {
	let exprs = {}
	let match = str.match(new RegExp(ExprRegex.source, 'ug')) || []
	for (let expr of match) try {
		let num_expr = chineseToExpr(expr)
		if (num_expr.match(/^[\d.]*$/))
			if (new RegExp(`^(${UnitRegex.source})+$`, 'u').test(expr)) continue // 跳过无数字的纯单位
		exprs[expr] = bigfloat.eval(num_expr)
	} catch (error) { }
	return exprs
}
