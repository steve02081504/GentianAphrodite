import { WorldInfoEntry } from "./charData.mjs"
import { escapeRegExp, parseRegexFromString, unescapeRegExp } from "./tools.mjs"
import { is_WILogicNode } from "./WILN.mjs"
import { regexgen } from './regexgen.mjs'
import { simplifyCharRange } from "./WIbookCompiler.mjs"

/**
 * @param {WorldInfoEntry} entrie
 * @return {string}
 */
function get_userscope_begin(entrie) {
	return '/{{user}}:[^]*' + (entrie.extensions.match_whole_words ? '\\b(' : '')
}

/**
 * @param {WorldInfoEntry} entrie
 * @return {string}
 */
function get_bothscope_begin(entrie) {
	return '/({{user}}|{{char}}):[^]*' + (entrie.extensions.match_whole_words ? '\\b(' : '')
}

/**
 * @param {WorldInfoEntry} entrie
 * @return {string}
 */
function get_userscope_end(entrie) {
	return (entrie.extensions.match_whole_words ? ')\\b' : '') + '/' + (entrie.extensions.case_sensitive ? '' : 'i')
}

/**
 * @param {WorldInfoEntry} entrie
 * @return {string}
 */
function get_bothscope_end(entrie) {
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

export function CompileKeyScope(reg_keys, entrie) {
	let /** @type {string[]} */user_scope_regs = [],
		/** @type {string[]} */user_scope_norms = [],
		/** @type {string[]} */both_scope_regs = [],
		/** @type {string[]} */both_scope_norms = [],
		/** @type {string[]} */common_regs = []

	keymap: for (let str of reg_keys) {
		for (let [normlist, reglist, begin, end] of [
			[user_scope_norms, user_scope_regs, get_userscope_begin(entrie), get_userscope_end(entrie)],
			[both_scope_norms, both_scope_regs, get_bothscope_begin(entrie), get_bothscope_end(entrie)]
		])
			if (str.startsWith(begin) && (str.endsWith(end) || str.endsWith('/'))) {
				let s = str.slice(begin.length)
				if (s.endsWith('/')) s = s.slice(0, -1)
				else s = s.slice(0, -end.length)
				let reg = `/${s}/`, norm = unescapeRegExp(s)
				if (`/${escapeRegExp(norm)}/` == reg) normlist.push(norm)
				else if (parseRegexFromString(reg)) reglist.push(reg)
				else normlist.push(norm)
				continue keymap
			}
		common_regs.push(str)
	}

	let result = []
	let new_reglists = []
	for (let reglist of [user_scope_regs, both_scope_regs]) {
		let char_ranges = []
		let not_ranges = []
		let others = []
		for (let reg of reglist)
			if (reg.startsWith('/[^') && reg.endsWith(']/') && !reg.slice(3, -2).match(/[\[\(]/))
				not_ranges.push(reg.slice(3, -2))
			else if (reg.startsWith('/[') && reg.endsWith(']/') && !reg.slice(2, -2).match(/[\[\(]/))
				char_ranges.push(reg.slice(2, -2))
			else
				others.push(reg)

		if (char_ranges.length) {
			let res = `/[${simplifyCharRange(char_ranges.join(''))}]/`
			others.push(res)
		}
		if (not_ranges.length) {
			let res = `/[^${simplifyCharRange(not_ranges.join(''))}]/`
			others.push(res)
		}
		new_reglists.push(others)
	}
	[user_scope_regs, both_scope_regs] = new_reglists

	for (let [normlist, reglist, begin, end] of [
		[user_scope_norms, user_scope_regs, get_userscope_begin(entrie), get_userscope_end(entrie)],
		[both_scope_norms, both_scope_regs, get_bothscope_begin(entrie), get_bothscope_end(entrie)]
	]) {
		if (normlist.length) reglist.push(regexgen(normlist).toString())

		if (reglist.length) {
			reglist = reglist.map(e => e.slice(1, -1))
			let res = reglist.length > 1 ? reglist.join('|') : reglist[0]
			result.push(begin + res + end)
		}
	}

	result = result.concat(common_regs).filter(e => e)
	if (result.length > 7) {
		console.warn(`Compiler may not work! len: ${result.length}`)
		console.warn(`input:`, reg_keys)
		console.warn(`processing datas:`)
		console.warn(`users scope begin:`, get_userscope_begin(entrie))
		console.warn(`users scope end:`, get_userscope_end(entrie))
		console.warn(`user norms:`, user_scope_norms)
		console.warn(`user regs:`, user_scope_regs)
		console.warn(`both scope begin:`, get_bothscope_begin(entrie))
		console.warn(`both scope end:`, get_bothscope_end(entrie))
		console.warn(`both norms:`, both_scope_norms)
		console.warn(`both regs:`, both_scope_regs)
		console.warn(`common regs:`, common_regs)
		console.warn(`result:`, result)
	}

	return result
}
