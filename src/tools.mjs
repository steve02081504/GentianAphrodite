import fs from 'fs';
/**
 * Checks if two arrays are equal.
 * @param {Array} a - The first array.
 * @param {Array} b - The second array.
 * @return {boolean} True if the arrays are equal, false otherwise.
 */
function arraysEqual(a, b) {
	if (a === b) return true;
	if (!a || !b) return false;
	if (a.length !== b.length) return false;

	for (var i = 0; i < a.length; ++i)
		if (a[i] !== b[i])
			return false;
	return true;
}

/**
 * Synchronously writes data to a file if the data is different from the existing data.
 *
 * @param {string} filePath - The path of the file to write to.
 * @param {string|Buffer} data - The data to write to the file.
 * @param {string} [encoding='utf8'] - The encoding to use when writing the file.
 * @return {void}
 */
function nicerWriteFileSync(filePath, data, encoding = 'utf8') {
	var oldData
	if (fs.existsSync(filePath))
		oldData = fs.readFileSync(filePath, encoding);
	if (oldData != data)
		fs.writeFileSync(filePath, data, encoding);
}

/**
 * Removes all empty directories in a directory recursively.
 * @param {string} dirPath - The directory to clear.
 * @return {boolean} True if the directory was cleared successfully, false otherwise.
 */
function clearEmptyDirs(dirPath) {
	var files = fs.readdirSync(dirPath, { recursive: true });
	var empty = true;
	for (const file of files) {
		var filePath = dirPath + '/' + file;
		if (fs.lstatSync(filePath).isDirectory() && clearEmptyDirs(filePath)) continue
		empty = false;
	}
	if (empty) fs.rmdirSync(dirPath);
	return empty;
}

/**
 * Recursively removes all instances of simple Marcos placeholders in the given object.
 *
 * @param {object|string} object - The object or string to search for placeholders.
 * @return {object|string} - The object or string with all instances of simple Marcos placeholders removed.
 */
function remove_simple_marcos(object) {
	if (Object(object) instanceof String) return object.replace(/{{\/\/([\s\S]*?)}}/g, '').replace(/\{\{user\}\}/i, 'user').replace(/\{\{char\}\}/i, 'char');
	for (const key in object) object[key] = remove_simple_marcos(object[key])
	return object
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
function parseRegexFromString(input) {
	// Extracting the regex pattern and flags
	let match = input.match(/^\/([\w\W]+?)\/([gimsuy]*)$/);
	if (!match) return null; // Not a valid regex format

	let [, pattern, flags] = match;

	// If we find any unescaped slash delimiter, we also exit out.
	// JS doesn't care about delimiters inside regex patterns, but for this to be a valid regex outside of our implementation,
	// we have to make sure that our delimiter is correctly escaped. Or every other engine would fail.
	if (pattern.match(/(^|[^\\])\//)) return null;

	// Now we need to actually unescape the slash delimiters, because JS doesn't care about delimiters
	pattern = pattern.replace('\\/', '/');

	// Then we return the regex. If it fails, it was invalid syntax.
	try {
		return new RegExp(pattern, flags);
	} catch (e) {
		return null;
	}
}

/**
 * Escapes special characters in a string to be used in a regular expression.
 *
 * @param {string} string - The string to escape.
 * @return {string} The escaped string.
 */
function escapeRegExp(string) {
	return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

export { arraysEqual, nicerWriteFileSync, clearEmptyDirs, remove_simple_marcos, parseRegexFromString, escapeRegExp };
