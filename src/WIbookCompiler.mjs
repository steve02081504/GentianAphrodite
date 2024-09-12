import { regexgen } from './regexgen.mjs'
import { WorldInfoEntry, world_info_logic } from './charData.mjs'
import { parseRegexFromString, unicodeEscapeToChar } from './tools.mjs'
import { keyscorespliter } from './keyScore.mjs'
import sha256 from 'crypto-js/sha256.js'
import { CompileKeyScope } from './key_scope.mjs'
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
	keylist = keylist.filter(e => e != keyscorespliter)
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

	return result.concat(CompileKeyScope(reg_keys, entrie))
}

/**
 * @param {string} char_range
 * @returns {string} simplified char_range
 */
export function simplifyCharRange(char_range) {
	char_range = unicodeEscapeToChar(char_range)
	let ranges = []
	char_range = char_range.replace(/.-./g, e => {
		let [min, max] = e.split('-').map(e => e.charCodeAt(0))
		ranges.push({ min, max })
		return ''
	})
	for (let char of char_range) ranges.push({ min: char.charCodeAt(0), max: char.charCodeAt(0) })

	let len;do {
		let simplified_ranges = [];len = ranges.length
		for (let { min, max } of ranges) {
			let found = false
			for (let range of simplified_ranges) {
				if (min - range.max <= 1)
					if (max > range.max) {
						range.max = max
						found = true;break
					}
				if (range.min - max <= 1)
					if (min < range.min) {
						range.min = min
						found = true;break
					}
			}
			if (!found) simplified_ranges.push({ min, max })
		}
		ranges = simplified_ranges
	} while (ranges.length != len)
	return ranges.map(
		({ min, max }) => min == max ?
			String.fromCharCode(min) :
			String.fromCharCode(min) + '-' + String.fromCharCode(max)
	).join('')
}
