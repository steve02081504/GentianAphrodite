import { WorldInfoEntry } from "./charData.mjs"
import { escapeRegExp, parseRegexFromString, unescapeRegExp } from "./tools.mjs"
import { is_WILogicNode } from "./WILN.mjs"

/**
 * @param {WorldInfoEntry} entrie
 * @return {string}
 */
export function get_userscope_begin(entrie) {
	return '/{{user}}:[^]*' + (entrie.extensions.match_whole_words ? '\\b(' : '')
}

/**
 * @param {WorldInfoEntry} entrie
 * @return {string}
 */
export function get_bothscope_begin(entrie) {
	return '/({{user}}|{{char}}):[^]*' + (entrie.extensions.match_whole_words ? '\\b(' : '')
}

/**
 * @param {WorldInfoEntry} entrie
 * @return {string}
 */
export function get_userscope_end(entrie) {
	return (entrie.extensions.match_whole_words ? ')\\b' : '') + '/' + (entrie.extensions.case_sensitive ? '' : 'i')
}

/**
 * @param {WorldInfoEntry} entrie
 * @return {string}
 */
export function get_bothscope_end(entrie) {
	return (entrie.extensions.match_whole_words ? ')\\b' : '') + '/' + (entrie.extensions.case_sensitive ? '' : 'i')
}

export function is_userscope(str) {
	return str.startsWith('u:')
}

export function is_bothscope(str) {
	return str.startsWith('b:')
}

/**
 * @param {string} str
 */
export function remove_userscope(str) {
	if (str.startsWith('u:')) return str.substr(2)
	return str
}

/**
 * @param {string} str
 */
export function remove_bothscope(str) {
	if (str.startsWith('b:')) return str.substr(2)
	return str
}

/**
 * @param {string} str
 * @param {WorldInfoEntry} entrie
 * @return {string}
 */
export function make_userscope(entrie, str) {
	if (is_WILogicNode(str)) return str
	if (parseRegexFromString(str)) return '/{{user}}:[^]*' + str.substr(1)
	return get_userscope_begin(entrie) + escapeRegExp(str) + get_userscope_end(entrie)
}
/**
 * @param {string} str
 * @param {WorldInfoEntry} entrie
 * @return {string}
 */
export function make_bothscope(entrie, str) {
	if (is_WILogicNode(str)) return str
	if (parseRegexFromString(str)) return '/({{user}}|{{char}}):[^]*' + str.substr(1)
	return get_bothscope_begin(entrie) + escapeRegExp(str) + get_bothscope_end(entrie)
}
/**
 * @param {string} str
 * @param {WorldInfoEntry} entrie
 * @return {string}
 */
export function unmake_scope(entrie, str) {
	if (is_WILogicNode(str)) return str
	for (let [begin, end] of [
		[get_userscope_begin(entrie), get_userscope_end(entrie)],
		[get_bothscope_begin(entrie), get_bothscope_end(entrie)]
	])
		if (str.startsWith(begin) && (str.endsWith(end) || str.endsWith('/'))) {
			let s = str.slice(begin.length)
			if (s.endsWith('/')) s = s.slice(0, -1)
			else s = s.slice(0, -end.length)
			let reg = `/${s}/`, norm = unescapeRegExp(s)
			if (`/${escapeRegExp(norm)}/` == reg) return norm
			if (parseRegexFromString(reg)) return reg
			return norm
		}
	return str
}
/**
 * @param {string} str
 * @param {WorldInfoEntry} entrie
 * @return {string}
 */
export function pack_key_scope(entrie, str) {
	if (is_userscope(str)) return make_userscope(entrie, str.substr(2))
	if (is_bothscope(str)) return make_bothscope(entrie, str.substr(2))
	return str
}
/**
 * @param {string} str
 * @param {WorldInfoEntry} entrie
 * @return {string}
 */
export function unpack_key_scope(entrie, str) {
	for (let [ledal, begin, end] of [
		['u:', get_userscope_begin(entrie), get_userscope_end(entrie)],
		['b:', get_bothscope_begin(entrie), get_bothscope_end(entrie)]
	])
		if (str.startsWith(begin) && (str.endsWith(end) || str.endsWith('/')))
			return ledal + unmake_scope(entrie, str)
	return str
}
