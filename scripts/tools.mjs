import fs from 'node:fs'
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

	for (var i = 0; i < a.length; ++i)
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
	var oldData
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
	var files = fs.readdirSync(dirPath, { recursive: true })
	var empty = true
	for (const file of files) {
		var filePath = dirPath + '/' + file
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
export function reverseStr (/** @type {string} */str) {
	return Array.from(str).reverse().join('')
}

/**
 * Gets a real regex object from a slash-delimited regex string
 *
 * This function works with `/` as delimiter, and each occurance of it inside the regex has to be escaped.
 * Flags are optional, but can only be valid flags supported by JavaScript's `RegExp` (`g`, `i`, `m`, `s`, `u`, `y`).
 *
 * @param {string} input - A delimited regex string
 * @returns {RegExp|null} The regex object, or null if not a valid regex
 */
export function parseRegexFromString(input) {
	// Extracting the regex pattern and flags
	let match = input.match(/^\/([\W\w]+?)\/([gimsuy]*)$/)
	if (!match) return null // Not a valid regex format

	let [, pattern, flags] = match

	// If we find any unescaped slash delimiter, we also exit out.
	// JS doesn't care about delimiters inside regex patterns, but for this to be a valid regex outside of our implementation,
	// we have to make sure that our delimiter is correctly escaped. Or every other engine would fail.
	if (pattern.match(/(^|[^\\])\//)) return null

	// Now we need to actually unescape the slash delimiters, because JS doesn't care about delimiters
	pattern = pattern.replace('\\/', '/')

	// Then we return the regex. If it fails, it was invalid syntax.
	try {
		return new RegExp(pattern, flags)
	} catch (e) {
		return null
	}
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
	return str.replace(/\\u[\dA-Fa-f]{4}/g, match=> String.fromCharCode(parseInt(match.replace('\\u', ''), 16)))
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

	let target = Array.isArray(object) ? [] : {}
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
export function RandIntLeesThan (x, y = 0, Rng = Math.random) { return Math.floor(Rng() * (x - y)) + y }
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
		let randomIndex = RandIntLeesThan(currentIndex, 0, Rng)
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
	let unpickscript = `let {${Object.keys(formats).join(', ')}} = formats;`
	return str.replace(/\${([^}]+)}/g, (match, p1) => eval(unpickscript+p1))
}
