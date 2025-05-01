import fs from 'node:fs'

export async function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Checks if two arrays are equal.
 * @param {Array} a - The first array.
 * @param {Array} b - The second array.
 * @return {boolean} True if the arrays are equal, false otherwise.
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
 * Synchronously writes data to a file if the data is different from the existing data.
 *
 * @param {string} filePath - The path of the file to write to.
 * @param {string|Buffer} data - The data to write to the file.
 * @param {string} [encoding='utf8'] - The encoding to use when writing the file.
 * @return {void}
 */
export function nicerWriteFileSync(filePath, data, encoding = 'utf8') {
	let oldData
	if (fs.existsSync(filePath))
		oldData = fs.readFileSync(filePath, encoding)
	if (oldData != data)
		fs.writeFileSync(filePath, data, encoding)
}

/**
 * Removes all empty directories in a directory recursively.
 * @param {string} dirPath - The directory to clear.
 * @return {boolean} True if the directory was cleared successfully, false otherwise.
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
 * Reverses a string.
 *
 * @param {string} str - The string to reverse.
 * @return {string} The reversed string.
 */
export function reverseStr(/** @type {string} */str) {
	return Array.from(str).reverse().join('')
}

/**
 * Gets a real regex object from a slash-delimited regex string
 *
 * This function works with `/` as delimiter, and each occurance of it inside the regex has to be escaped.
 * Flags are optional, but can only be valid flags supported by JavaScript's `RegExp` (`g`, `i`, `m`, `s`, `u`, `y`).
 *
 * @param {string} input - A delimited regex string
 * @returns {RegExp} The regex object
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
 * Escapes special characters in a string to be used in a regular expression.
 *
 * @param {string} string - The string to escape.
 * @return {string} The escaped string.
 */
export function escapeRegExp(string) {
	return string.replace(/[$()*+./?[\\-^{|}]/g, '\\$&')
}
/**
 * Replaces Unicode escape sequences in a string with their corresponding characters.
 *
 * @param {string} str - The input string possibly containing Unicode escape sequences.
 * @return {string} The string with Unicode escape sequences replaced by actual characters.
 */
export function unescapeRegExp(string) {
	return string.replace(/\\(.)/g, '$1')
}

/**
 * Replaces Unicode escape sequences in a string with their corresponding characters.
 *
 * @param {string} str - The input string possibly containing Unicode escape sequences.
 * @return {string} The string with Unicode escape sequences replaced by actual characters.
 */
export function unicodeEscapeToChar(str) {
	return str.replace(/\\u[\dA-Fa-f]{4}/g, match => String.fromCharCode(parseInt(match.replace('\\u', ''), 16)))
}

/**
 * Recursively creates a deep copy of the given object.
 * @template T
 * @param {T} object - The object to be copied.
 * @param {WeakMap<object, object>} [weakMap] - A WeakMap used to store the copied objects.
 * @return {T} A deep copy of the object.
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
 * Replaces Unicode escape sequences in a string with their corresponding characters.
 *
 * @param {string} str - The input string possibly containing Unicode escape sequences.
 * @return {string} The string with Unicode escape sequences replaced by actual characters.
 */
export function unescapeUnicode(str) {
	if (!(Object(str) instanceof String)) str = str.toString()
	return str.replace(/\\u([\da-f]{4})/gi, (match, p1) => String.fromCharCode(parseInt(p1, 16)))
}

/**
 * Removes duplicate entries from the array or object tree.
 * @param {Object|Array} data - The data containing entries to process.
 * @returns {Object|Array} The data with duplicate entries removed.
 */
export function removeDuplicates(data) {
	if (typeof data == 'string') return data
	for (const key in data)
		data[key] = removeDuplicates(data[key])

	if (Array.isArray(data))
		return [...new Set(data)].sort()
	return data
}

/**
 * Returns a random integer between `y` (inclusive) and `x` (exclusive).
 *
 * @param {number} x - The maximum value.
 * @param {number} y - The minimum value.
 * @returns {number} A random integer between `y` (inclusive) and `x` (exclusive).
 */
export function RandIntLeesThan(x, y = 0, Rng = Math.random) { return Math.floor(Rng() * (x - y)) + y }
/**
 * Shuffles the elements of an array using the Fisher-Yates algorithm.
 *
 * @template T
 * @param {Array<T>} a - The array to be shuffled.
 * @return {Array<T>} - The shuffled array.
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
 * 匹配一个string中的所有的${expr}，替换为eval结果
 * @param {string} str
 * @param {Record<string, any>} formats
 */
export function FormatStr(str, formats) {
	const unpickscript = `let {${Object.keys(formats).join(', ')}} = formats;`
	return str.replace(/\${([^}]+)}/g, (match, p1) => eval(unpickscript + p1))
}

/**
 * @template T
 * @param {T[]} arr
 * @param {(obj:T) => any} summarier
 * @return {{element: T, count: number}}
 * @description Returns the most frequent element in the array.
 */
export function findMostFrequentElement(arr, summarier = x => x) {
	const countMap = {}
	let maxCount = 0
	let mostFrequentElement

	arr.forEach(element => {
		const summary = summarier(element)
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
 * @function parseDuration
 * @description Converts a duration string to a number of milliseconds.
 * @param {string} durationString A duration string. The string can contain
 * multiple space-separated parts, each part consists of a number and a unit.
 * The unit can be any of the following:
 * <ul>
 * <li>seconds, sec, s,  </li>
 * <li>minutes, min, m,  </li>
 * <li>hours, hour, h,  </li>
 * <li>days, day, d,  </li>
 * <li>weeks, week, wk, w,  </li>
 * <li>months, month, mo,  </li>
 * <li>years, year, y,  </li>
 * <li>century, cent, c,  </li>
 * </ul>
 * For example, "3 days 2 hours" will be converted to 3*24*60*60*1000 + 2*60*60*1000 milliseconds.
 * @returns {number} The number of milliseconds.
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
	return duration
}
