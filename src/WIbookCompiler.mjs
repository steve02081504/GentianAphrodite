import { regexgen } from './regexgen.mjs'
import { WorldInfoEntry, world_info_logic } from './charData.mjs'
import { escapeRegExp, parseRegexFromString, unescapeRegExp, unicodeEscapeToChar } from './tools.mjs'
import regexp from 'regexp-tree'
import { get_bothscope_begin, get_bothscope_end, get_userscope_begin, get_userscope_end } from './key_scope.mjs'
import { is_CompiledWILogicNode, WILogicNodeCompiler } from './WILN.mjs'
/**
 * @param {WorldInfoEntry[]} entries
 * @param {string} sign
 * @returns {WorldInfoEntry[]}
 */
export function WIbookCompiler(entries, sign) {
	entries = WILogicNodeCompiler(entries, sign)
	for (let entrie of entries) {
		if (entrie.extensions.selectiveLogic == world_info_logic.NOT_ALL || entrie.extensions.selectiveLogic == world_info_logic.NOT_ANY)
			entrie.secondary_keys = entrie.secondary_keys.filter(e => !is_CompiledWILogicNode(e))
		entrie.keys = keylistCompile(entrie.keys, world_info_logic.AND_ANY, entrie)
		entrie.secondary_keys = keylistCompile(entrie.secondary_keys, entrie.extensions.selectiveLogic, entrie)
	}
	return entries
}
/**
 * @param {string[]} keylist
 * @param {world_info_logic} selectiveLogic
 * @param {WorldInfoEntry} entrie
 * @returns {string[]}
 */
function keylistCompile(keylist, selectiveLogic, entrie) {
	if (selectiveLogic == world_info_logic.NOT_ALL || selectiveLogic == world_info_logic.AND_ALL) return keylist
	if (entrie.extensions.case_sensitive === false) keylist = keylist.map(e => e.toLowerCase())
	let result = []
	let reg_keys = []
	let common_keys = []
	for (let key of keylist)
		if (parseRegexFromString(key)) reg_keys.push(key)
		else common_keys.push(key)

	if (common_keys.length) {
		let res = regexgen(common_keys).toString()
		if (res.replace(/[\/\\-\^\$\*\+\?\.\(\)\|\[\]\{\}]/g, '').length >= common_keys.join('|').length)
			result = result.concat(common_keys)
		else
			result.push(res)
	}

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
			let res = `/[${char_ranges.join('')}]/`
			others.push(res)
		}
		if (not_ranges.length) {
			let res = `/[^${not_ranges.join('')}]/`
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

	result = result.concat(common_regs).filter(e => e).map(
		e => parseRegexFromString(e) ? unicodeEscapeToChar(regexp.optimize(e).toString()) : e
	)
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
