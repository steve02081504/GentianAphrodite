import fs from 'node:fs'

import { async_eval } from 'https://cdn.jsdelivr.net/gh/steve02081504/async-eval/deno.mjs'

/**
 * 暂停执行指定的毫秒数。
 * @param {number} ms - 要暂停的毫秒数。
 * @returns {Promise<void>}
 */
export async function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 检查两个数组是否相等。
 * @param {Array} a - 第一个数组。
 * @param {Array} b - 第二个数组。
 * @returns {boolean} - 如果数组相等则返回 true，否则返回 false。
 */
export function arraysEqual(a, b) {
	if (a === b) return true
	if (!a || !b) return false
	if (a.length !== b.length) return false

	for (let i = 0; i < a.length; ++i)
		if (a[i] !== b[i])
			return false
	return true
}

/**
 * 如果数据与现有数据不同，则同步将数据写入文件。
 * @param {string} filePath - 要写入的文件的路径。
 * @param {string|Buffer} data - 要写入文件的数据。
 * @param {string} [encoding='utf8'] - 写入文件时使用的编码。
 */
export function nicerWriteFileSync(filePath, data, encoding) {
	if (Object(data) instanceof String) encoding ??= 'utf8'
	let oldData
	if (fs.existsSync(filePath))
		oldData = fs.readFileSync(filePath, encoding)
	if (oldData != data)
		fs.writeFileSync(filePath, data, encoding)
}

/**
 * 递归地删除目录中的所有空目录。
 * @param {string} dirPath - 要清理的目录。
 * @returns {boolean} - 如果目录被成功清理，则返回 true，否则返回 false。
 */
export function clearEmptyDirs(dirPath) {
	const files = fs.readdirSync(dirPath, { recursive: true })
	let empty = true
	for (const file of files) {
		const filePath = dirPath + '/' + file
		if (fs.lstatSync(filePath).isDirectory() && clearEmptyDirs(filePath)) continue
		empty = false
	}
	if (empty) fs.rmdirSync(dirPath)
	return empty
}

/**
 * 反转一个字符串。
 * @param {string} str - 要反转的字符串。
 * @returns {string} - 反转后的字符串。
 */
export function reverseStr(/** @type {string} */str) {
	return Array.from(str).reverse().join('')
}

/**
 * 从斜杠分隔的正则表达式字符串中获取一个真正的正则表达式对象。
 * @param {string} input - 分隔的正则表达式字符串。
 * @returns {RegExp} - 正则表达式对象。
 */
export function parseRegexFromString(input) {
	// Extracting the regex pattern and flags
	const match = input.match(/^\/([\W\w]+?)\/([gimsuy]*)$/)
	if (!match) throw new Error(`Invalid regex string: ${input}`)

	let [, pattern, flags] = match

	// If we find any unescaped slash delimiter, we also exit out.
	// JS doesn't care about delimiters inside regex patterns, but for this to be a valid regex outside of our implementation,
	// we have to make sure that our delimiter is correctly escaped. Or every other engine would fail.
	if (pattern.match(/(^|[^\\])\//)) throw new Error(`there is an unescaped slash in the regex: ${input}`)

	// Now we need to actually unescape the slash delimiters, because JS doesn't care about delimiters
	pattern = pattern.replace('\\/', '/')

	// Then we return the regex. If it fails, it was invalid syntax.
	return new RegExp(pattern, flags)
}

/**
 * 转义字符串中的特殊字符，以便在正则表达式中使用。
 * @param {string} string - 要转义的字符串。
 * @returns {string} - 转义后的字符串。
 */
export function escapeRegExp(string) {
	return string.replace(/[$()*+./?[\\-^{|}]/g, '\\$&')
}
/**
 * 将字符串中的转义字符替换为它们的原始字符。
 * @param {string} string - 可能包含转义字符的输入字符串。
 * @returns {string} - 移除了转义的字符串。
 */
export function unescapeRegExp(string) {
	return string.replace(/\\(.)/g, '$1')
}

/**
 * 将字符串中的 Unicode 转义序列替换为它们对应的字符。
 * @param {string} str - 可能包含 Unicode 转义序列的输入字符串。
 * @returns {string} - 替换了 Unicode 转义序列的字符串。
 */
export function unicodeEscapeToChar(str) {
	return str.replace(/\\u[\dA-Fa-f]{4}/g, match => String.fromCharCode(parseInt(match.replace('\\u', ''), 16)))
}

/**
 * 递归地创建给定对象的深层副本。
 * @template T
 * @param {T} object - 要复制的对象。
 * @param {WeakMap<object, object>} [weakMap] - 用于存储已复制对象的 WeakMap。
 * @returns {T} - 对象的深层副本。
 */
export function deepCopy(object, weakMap = new WeakMap()) {
	if (!object || !(object instanceof Object)) return object

	if (weakMap.has(object)) return weakMap.get(object)

	const target = Array.isArray(object) ? [] : {}
	weakMap.set(object, target)
	for (const key in object)
		if (Object.hasOwnProperty.call(object, key)) target[key] = deepCopy(object[key], weakMap)
	Object.setPrototypeOf(target, Object.getPrototypeOf(object))

	return target
}


/**
 * 递归地将两个对象合并到一个新对象中。
 * @template T, U
 * @param {T | null | undefined} obj1 - 要合并的第一个对象。
 * @param {U | null | undefined} obj2 - 要合并的第二个对象。
 * @param {WeakMap<object, object>} [weakMap] - 用于存储已复制对象的 WeakMap。
 * @returns {T & U} - 合并两个输入对象后产生的新对象。
 */
export function mergeTree(obj1, obj2, weakMap = new WeakMap()) {
	if (!obj1 || !(obj1 instanceof Object)) return obj2 ?? obj1
	if (obj1 instanceof String) return obj2 ?? obj1
	const target = deepCopy(obj1, weakMap)
	for (const key in obj2)
		if (Object.hasOwnProperty.call(obj2, key)) target[key] = mergeTree(obj1?.[key], obj2?.[key], weakMap)

	return target
}

/**
 * 将字符串中的 Unicode 转义序列替换为它们对应的字符。
 * @param {string} str - 可能包含 Unicode 转义序列的输入字符串。
 * @returns {string} - 替换了 Unicode 转义序列的字符串。
 */
export function unescapeUnicode(str) {
	if (!(Object(str) instanceof String)) str = str.toString()
	return str.replace(/\\u([\da-f]{4})/gi, (match, p1) => String.fromCharCode(parseInt(p1, 16)))
}

/**
 * 从数组或对象树中删除重复的条目。
 * @param {Object|Array} data - 包含要处理的条目的数据。
 * @returns {Object|Array} - 删除了重复条目的数据。
 */
export function removeDuplicates(data) {
	if (Object(data) instanceof String) return data
	for (const key in data)
		data[key] = removeDuplicates(data[key])

	if (Array.isArray(data))
		return [...new Set(data)].sort()
	return data
}

/**
 * 返回 `y` (含) 和 `x` (不含) 之间的一个随机整数。
 * @param {number} x - 最大值。
 * @param {number} [y=0] - 最小值。
 * @param {Function} [Rng=Math.random] - 随机数生成器。
 * @returns {number} - `y` (含) 和 `x` (不含) 之间的一个随机整数。
 */
export function RandIntLeesThan(x, y = 0, Rng = Math.random) { return Math.floor(Rng() * (x - y)) + y }
/**
 * 使用 Fisher-Yates 算法打乱数组的元素。
 * @template T
 * @param {Array<T>} a - 要打乱的数组。
 * @param {Function} [Rng=Math.random] - 随机数生成器。
 * @returns {Array<T>} - 打乱后的数组。
 */
export function suffleArray(a, Rng = Math.random) {
	let currentIndex = a.length

	while (currentIndex != 0) {
		const randomIndex = RandIntLeesThan(currentIndex, 0, Rng)
		currentIndex--;
		[a[currentIndex], a[randomIndex]] = [a[randomIndex], a[currentIndex]]
	}
	return a
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
	while (str.indexOf('${') != -1) {
		const length = str.indexOf('${')
		result += str.slice(0, length)
		str = str.slice(length + 2)
		let end_index = 0
		find: while (str.indexOf('}', end_index) != -1) { // 我们需要遍历所有的结束符直到表达式跑通
			end_index = str.indexOf('}', end_index) + 1
			const expression = str.slice(0, end_index - 1)
			try {
				const eval_result = await async_eval(expression, formats)
				result += eval_result.result
				str = str.slice(end_index)
				break find
			} catch (error) { /* ignore any error */ }
		}
	}
	result += str
	return result
}

/**
 * 返回数组中最频繁出现的元素。
 * @template T
 * @param {T[]} arr - 要检查的数组。
 * @param {(obj:T) => any} [summarier=x=>x] - 一个函数，用于从数组元素中提取用于比较的值。
 * @returns {{element: T, count: number}} - 包含最频繁出现的元素和其出现次数的对象。
 */
export function findMostFrequentElement(arr, summarier = x => x) {
	const countMap = {}
	let maxCount = 0
	let mostFrequentElement

	arr.forEach(element => {
		const summary = String(summarier(element))
		countMap[summary] = (countMap[summary] || 0) + 1
		if (countMap[summary] > maxCount) {
			maxCount = countMap[summary]
			mostFrequentElement = element
		}
	})

	return {
		element: mostFrequentElement,
		count: maxCount
	}
}

/**
 * 将持续时间字符串转换为毫秒数。
 * @param {string} durationString - 持续时间字符串，例如 "3 days 2 hours"。
 * @returns {number} - 毫秒数。
 */
export function parseDuration(durationString) {
	const dict = {
		seconds: 1000,
		sec: 1000,
		s: 1000,
		minutes: 60 * 1000,
		min: 60 * 1000,
		m: 60 * 1000,
		hours: 60 * 60 * 1000,
		hour: 60 * 60 * 1000,
		h: 60 * 60 * 1000,
		days: 24 * 60 * 60 * 1000,
		day: 24 * 60 * 60 * 1000,
		d: 24 * 60 * 60 * 1000,
		weeks: 7 * 24 * 60 * 60 * 1000,
		week: 7 * 24 * 60 * 60 * 1000,
		wk: 7 * 24 * 60 * 60 * 1000,
		w: 7 * 24 * 60 * 60 * 1000,
		months: 30 * 24 * 60 * 60 * 1000,
		month: 30 * 24 * 60 * 60 * 1000,
		mo: 30 * 24 * 60 * 60 * 1000,
		years: 365 * 24 * 60 * 60 * 1000,
		year: 365 * 24 * 60 * 60 * 1000,
		y: 365 * 24 * 60 * 60 * 1000,
		century: 100 * 365 * 24 * 60 * 60 * 1000,
		cent: 100 * 365 * 24 * 60 * 60 * 1000,
		c: 100 * 365 * 24 * 60 * 60 * 1000,
		秒: 1000,
		分钟: 60 * 1000,
		分: 60 * 1000,
		小时: 60 * 60 * 1000,
		时: 60 * 60 * 1000,
		时辰: 2 * 60 * 60 * 1000,
		天: 24 * 60 * 60 * 1000,
		日: 24 * 60 * 60 * 1000,
		星期: 7 * 24 * 60 * 60 * 1000,
		周: 7 * 24 * 60 * 60 * 1000,
		月: 30 * 24 * 60 * 60 * 1000,
		年: 365 * 24 * 60 * 60 * 1000,
		世纪: 100 * 365 * 24 * 60 * 60 * 1000,
	}

	let duration = 0
	for (const unit in dict) {
		const match = durationString.match(new RegExp(`(?<value>\\d+)${unit}`))
		if (match?.groups?.value) {
			duration += parseInt(match.groups.value) * dict[unit]
			durationString = durationString.replace(match[0], '')
		}
	}
	if (durationString.trim())
		throw new Error('Invalid duration input')

	return duration
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

const timeToStrSetting = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
/**
 * 将日期对象格式化为本地化的日期时间字符串。
 * @param {Date|number} date - 要格式化的日期对象或时间戳。
 * @param {string} [locale] - 用于格式化的区域设置字符串。
 * @param {object} [setting=timeToStrSetting] - `toLocaleString` 的选项对象。
 * @returns {string} - 格式化后的日期时间字符串。
 */
export function timeToStr(date, locale, setting = timeToStrSetting) {
	return new Date(date).toLocaleString(locale || undefined, setting)
}
const MS_PER_SECOND = 1000
const MS_PER_MINUTE = MS_PER_SECOND * 60
const MS_PER_HOUR = MS_PER_MINUTE * 60
const MS_PER_DAY = MS_PER_HOUR * 24

// 翻译和区域设置特定配置
const translations = {
	'zh-CN': {
		day: '天', days: '天',
		hour: '小时', hours: '小时',
		minute: '分钟', minutes: '分钟',
		second: '秒', seconds: '秒',
		millisecond: '毫秒', milliseconds: '毫秒',
		separator: '',        // 不同时间单位之间的分隔符 (例如 "1天2小时" 中间没有分隔符)
		numberUnitSpace: false // 数字和单位之间是否需要空格 (例如 "1天" 中间没有空格)
	},
	'en-US': {
		day: 'day', days: 'days',
		hour: 'hour', hours: 'hours',
		minute: 'minute', minutes: 'minutes',
		second: 'second', seconds: 'seconds',
		millisecond: 'millisecond', milliseconds: 'milliseconds',
		separator: ' ',       // 不同时间单位之间的分隔符 (例如 "1 day 2 hours" 中间有空格)
		numberUnitSpace: true // 数字和单位之间是否需要空格 (例如 "1 day" 中间有空格)
	}
}

/**
 * 将毫秒差转换为本地化的、人类可读的持续时间字符串。
 * @param {number} diff - 毫秒差。
 * @param {string} [locale='en-US'] - 用于本地化的区域设置字符串。
 * @returns {string} - 格式化后的持续时间字符串。
 */
export function timeToTimeStr(diff, locale = 'en-US') {
	const effectiveLocale = translations[locale] ? locale : 'en-US'
	const unitConfig = translations[effectiveLocale]

	const days = Math.floor(diff / MS_PER_DAY)
	let remainder = diff % MS_PER_DAY

	const hours = Math.floor(remainder / MS_PER_HOUR)
	remainder %= MS_PER_HOUR

	const minutes = Math.floor(remainder / MS_PER_MINUTE)
	remainder %= MS_PER_MINUTE

	const seconds = Math.floor(remainder / MS_PER_SECOND)
	const milliseconds = remainder % MS_PER_SECOND

	const timeComponents = [
		{ value: days, singular: unitConfig.day, plural: unitConfig.days },
		{ value: hours, singular: unitConfig.hour, plural: unitConfig.hours },
		{ value: minutes, singular: unitConfig.minute, plural: unitConfig.minutes },
		{ value: seconds, singular: unitConfig.second, plural: unitConfig.seconds },
		{ value: milliseconds, singular: unitConfig.millisecond, plural: unitConfig.milliseconds },
	]

	const parts = []
	for (const component of timeComponents)
		if (component.value > 0) {
			const unitName = component.value == 1 ? component.singular : component.plural
			const valueStr = component.value

			if (unitConfig.numberUnitSpace)
				parts.push(`${valueStr} ${unitName}`)
			else
				parts.push(`${valueStr}${unitName}`)
		}

	return parts.join(unitConfig.separator)
}

/**
 * 捕获主屏幕的截图。
 * @returns {Promise<Buffer>} - PNG 格式的屏幕截图 Buffer。
 */
export async function captureScreen() {
	const { Monitor } = await import('npm:node-screenshots')
	const monitors = Monitor.all()
	const mainMonitor = monitors[0]
	const image = await mainMonitor.captureImage()

	return await image.toPng()
}
