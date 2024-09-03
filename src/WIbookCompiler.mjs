import { regexgen } from './regexgen.mjs'
import { WorldInfoEntry, world_info_logic } from './charData.mjs'
import { escapeRegExp, parseRegexFromString, unescapeRegExp } from './tools.mjs'
import { keyscorespliter } from './keyScore.mjs'
import sha256 from 'crypto-js/sha256.js'
/**
 * @param {WorldInfoEntry[]} entries
 * @param {string} sign
 * @returns {WorldInfoEntry[]}
 */
export function WIbookCompiler(entries, sign) {
	let entriesStr = JSON.stringify(entries).replace(/<-<WI(推理节点|推理節點|LogicalNode)(：|:)([\s\S]+?)>->/g, key =>
		'<-' + sha256(sign + key).toString().substring(0, 6) + '->'
	)
	entries = JSON.parse(entriesStr)
	for (let entrie of entries) {
		entrie.keys = keylistCompile(entrie.keys, world_info_logic.AND_ANY)
		entrie.secondary_keys = keylistCompile(entrie.secondary_keys, entrie.extensions.selectiveLogic)
	}
	return entries
}
/**
 * @param {string[]} keylist
 * @param {world_info_logic} selectiveLogic
 * @returns {string[]}
 */
function keylistCompile(keylist, selectiveLogic) {
	keylist = keylist.filter(e => e != keyscorespliter)
	if (selectiveLogic == world_info_logic.NOT_ALL || selectiveLogic == world_info_logic.AND_ALL) return keylist
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

	let user_scope_regs = [], user_scope_norms = [], both_scope_regs = [], both_scope_norms = [], common_regs = []
	for (let str of reg_keys)
		if (str.startsWith('/{{user}}:.*') && str.endsWith('/')) {
			let s = str.slice('/{{user}}:.*'.length)
			let reg = '/' + s, norm = unescapeRegExp(s.slice(0, s.length - 1))
			if (`/${escapeRegExp(norm)}/` == reg) user_scope_norms.push(norm)
			else if (parseRegexFromString(reg)) user_scope_regs.push(reg)
			else user_scope_norms.push(norm)
		}
		else if (str.startsWith('/({{user}}|{{char}}):.*') && str.endsWith('/')) {
			let s = str.slice('/({{user}}|{{char}}):.*'.length)
			let reg = '/' + s, norm = unescapeRegExp(s.slice(0, s.length - 1))
			if (`/${escapeRegExp(norm)}/` == reg) both_scope_norms.push(norm)
			else if (parseRegexFromString(reg)) both_scope_regs.push(reg)
			else both_scope_norms.push(norm)
		}
		else common_regs.push(str)

	if (user_scope_norms.length) user_scope_regs.push(regexgen(user_scope_norms).toString())
	if (both_scope_norms.length) both_scope_regs.push(regexgen(both_scope_norms).toString())
	user_scope_regs=user_scope_regs.map(e=>e.slice(1,-1))
	both_scope_regs=both_scope_regs.map(e=>e.slice(1,-1))

	if (user_scope_regs.length > 1) result.push(`/{{user}}:.*(${user_scope_regs.join('|')})/`)
	else if (user_scope_regs.length) result.push(`/{{user}}:.*${user_scope_regs[0]}/`)
	if (both_scope_regs.length > 1) result.push(`/({{user}}|{{char}}):.*(${both_scope_regs.join('|')})/`)
	else if (both_scope_regs.length) result.push(`/({{user}}|{{char}}):.*${both_scope_regs[0]}/`)

	return result.concat(common_regs).filter(e => e)
}
