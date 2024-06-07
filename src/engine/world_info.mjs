import { wi_anchor_position, world_info_logic, world_info_position, WorldInfoEntry, v2CharData } from "../charData.mjs";
import { evaluateMacros } from "./marco.mjs";

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

let WISettings = {
	depth: 4,
	isSensitive: false,
	isFullWordMatch: true
}
function escapeRegex(string) {
	return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}
function buildKeyList(keys, isSensitive, isFullWordMatch) {
	let aret = []
	for (let key of keys) {
		let regtest = parseRegexFromString(key)
		if (regtest) {
			aret.push(regtest)
			continue
		}
		key = escapeRegex(key)
		if (isFullWordMatch) key = `\\b${key}\\b`
		let regex_key = new RegExp(key, isSensitive ? 'g' : 'gi')
		aret.push(regex_key)
	}
	return aret
}
function isAnyMatch(/** @type {RegExp[]} */list, /** @type {string} */content) {
	for (let key of list) if (key.test(content)) return true
	return false
}
function isAllMatch(/** @type {RegExp[]} */list, /** @type {string} */content) {
	for (let key of list) if (!key.test(content)) return false
	return true
}
function preBuiltWIEntries(
	/** @type {WorldInfoEntry[]} */
	WIentries
) {
	for (let entrie of WIentries) {
		let isSensitive = entrie.extensions.case_sensitive === undefined ? WISettings.isSensitive : entrie.extensions.case_sensitive
		let isFullWordMatch = entrie.extensions.match_whole_words === undefined ? WISettings.isFullWordMatch : entrie.extensions.match_whole_words
		entrie.keys = buildKeyList(entrie.keys, isSensitive, isFullWordMatch)
		entrie.secondary_keys = buildKeyList(entrie.secondary_keys, isSensitive, isFullWordMatch)
		let scan_depth = entrie.extensions.scan_depth === undefined ? WISettings.depth : entrie.extensions.scan_depth
		entrie.isActived = (
			/** @type {{role:string,content:string}[]} */
			chatLog,
			/** @type {string[]} */
			recursion_WIs
		) => {
			let content = chatLog.slice(-scan_depth).map(e => e.content).join('\n')
			if (!entrie.extensions.exclude_recursion) content += '\n' + recursion_WIs.join('\n')
			if (isAnyMatch(entrie.keys, content)) {
				if (entrie.secondary_keys.length === 0) return true
				switch (entrie.extensions.selectiveLogic) {
					case world_info_logic.AND_ALL:
						return isAllMatch(entrie.secondary_keys, content)
					case world_info_logic.AND_ANY:
						return isAnyMatch(entrie.secondary_keys, content)
					case world_info_logic.NOT_ALL:
						return !isAllMatch(entrie.secondary_keys, content)
					case world_info_logic.NOT_ANY:
						return !isAnyMatch(entrie.secondary_keys, content)
				}
			}
		}
	}
}
export function GetActivedWorldInfoEntries(
	/** @type {WorldInfoEntry[]} */
	WIentries,
	/** @type {{role:string,content:string}[]} */
	chatLog,
	/** @type {Record<string, any>} */
	env
) {
	/** @type {WorldInfoEntry[]} */
	let WIdata_copy = JSON.parse(JSON.stringify(WIentries.filter(e => e.enabled)))
	let aret = []
	for (let entrie of WIdata_copy) {
		entrie.keys = entrie.keys.map(k => evaluateMacros(k, env)).filter(k => k)
		entrie.secondary_keys = entrie.secondary_keys.map(k => evaluateMacros(k, env)).filter(k => k)
		// the entrie.content's macros evaluate ill only do whrn it be active
	}
	preBuiltWIEntries(WIdata_copy)
	let recursion_WIs = []
	let recursion_WI_size = 0
	let WIdata_new = WIdata_copy
	for (let entrie of WIdata_copy) {
		if (entrie.constant || entrie.isActived(chatLog, recursion_WIs)) {
			entrie.content = evaluateMacros(entrie.content, env)
			if (!entrie.extensions.prevent_recursion) recursion_WIs.push(entrie.content)
			aret.push(entrie)
			WIdata_new = WIdata_new.filter(e => e !== entrie)
		}
	}
	WIdata_copy = WIdata_new.filter(e => !e.extensions.exclude_recursion)
	do {
		recursion_WI_size = recursion_WIs.length
		let WIdata_new = [...WIdata_copy]
		for (let entrie of WIdata_copy) {
			if (entrie.isActived(chatLog, recursion_WIs)) {
				entrie.content = evaluateMacros(entrie.content, env)
				if (!entrie.extensions.prevent_recursion) recursion_WIs.push(entrie.content)
				aret.push(entrie)
				WIdata_new = WIdata_new.filter(e => e !== entrie)
			}
		}
		WIdata_copy = WIdata_new
	} while (recursion_WI_size < recursion_WIs.length)
	for (let entrie of aret) delete entrie.isActived
	return aret
}
