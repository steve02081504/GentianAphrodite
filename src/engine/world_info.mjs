import crypto from "crypto-js"
import { world_info_logic, world_info_position, WorldInfoEntry, extension_prompt_roles } from "../charData.mjs"
import { chat_metadata } from "../prompt_builder.mjs"
import { deepCopy, escapeRegExp, parseRegexFromString } from "../tools.mjs"
import { evaluateMacros } from "./marco.mjs"

let WISettings = {
	depth: 4,
	isSensitive: false,
	isFullWordMatch: true
}

function buildKeyList(keys, isSensitive, isFullWordMatch) {
	let aret = []
	for (let key of keys) {
		let regtest = parseRegexFromString(key)
		if (regtest) {
			aret.push(regtest)
			continue
		}
		key = escapeRegExp(key)
		if (isFullWordMatch) key = `\\b${key}\\b`
		let regex_key = new RegExp(key, isSensitive ? 'ug' : 'ugi')
		aret.push(regex_key)
	}
	return aret
}
function isAnyMatch(/** @type {RegExp[]} */list, /** @type {string[]} */contents) {
	for (let content of contents) for (let key of list) if (key.test(content)) return true
	return false
}
function isAllMatch(/** @type {RegExp[]} */list, /** @type {string[]} */contents) {
	for (let content of contents) for (let key of list) if (!key.test(content)) return false
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
		entrie.uuid = crypto.SHA256(entrie.keys.join()+entrie.secondary_keys.join()+entrie.content).toString()
		entrie.isActived = (
			/** @type {{role:string,charname?:string,content:string}[]} */
			chatLog,
			/** @type {string[]} */
			recursion_WIs
		) => {
			let last_enabled_chat_length = chat_metadata.enabled_WI_entries[entrie.uuid] ?? 0
			if (entrie.extensions.delay)
				if (entrie.extensions.delay > chat_metadata.chat_log.length)
					return false
			if (entrie.extensions.sticky)
				if (last_enabled_chat_length + entrie.extensions.sticky >= chatLog.length)
					return true
			if(entrie.extensions.cooldown)
				if (last_enabled_chat_length + entrie.extensions.cooldown <= chatLog.length)
					return false
			let content = chatLog.slice(-scan_depth).map(e => (e.charname || e.role)+': '+e.content)
			if (!entrie.extensions.exclude_recursion) content.push(recursion_WIs.join('\n'))
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
	/** @type {{role:string,charname?:string,content:string}[]} */
	chatLog,
	/** @type {Record<string, any>} */
	env
) {
	/** @type {WorldInfoEntry[]} */
	let WIdata_copy = deepCopy(WIentries.filter(e => e.enabled))
	let aret = []
	for (let entrie of WIdata_copy) {
		entrie.keys = entrie.keys.map(k => evaluateMacros(k, env)).filter(k => k)
		entrie.secondary_keys = entrie.secondary_keys.map(k => evaluateMacros(k, env)).filter(k => k)
		entrie.extensions ??= {}
		entrie.extensions.position ??= entrie.position == 'before_char' ? world_info_position.before : world_info_position.after
		entrie.extensions.role ??= extension_prompt_roles.SYSTEM
		// the entrie.content's macros evaluate ill only do whrn it be active
	}
	preBuiltWIEntries(WIdata_copy)
	let recursion_WIs = []
	let recursion_WI_size = 0
	let WIdata_new = WIdata_copy
	for (let entrie of WIdata_copy)
		if (entrie.constant || entrie.isActived(chatLog, recursion_WIs)) {
			chat_metadata.enabled_WI_entries[entrie.uuid] = chat_metadata.chat_log.length
			entrie.content = evaluateMacros(entrie.content, env)
			if (!entrie.extensions.prevent_recursion) recursion_WIs.push(entrie.content)
			aret.push(entrie)
			WIdata_new = WIdata_new.filter(e => e !== entrie)
		}

	WIdata_copy = WIdata_new.filter(e => !e.extensions.exclude_recursion)
	do {
		recursion_WI_size = recursion_WIs.length
		let WIdata_new = [...WIdata_copy]
		for (let entrie of WIdata_copy)
			if (entrie.isActived(chatLog, recursion_WIs)) {
				entrie.content = evaluateMacros(entrie.content, env)
				if (!entrie.extensions.prevent_recursion) recursion_WIs.push(entrie.content)
				aret.push(entrie)
				WIdata_new = WIdata_new.filter(e => e !== entrie)
			}

		WIdata_copy = WIdata_new
	} while (recursion_WI_size < recursion_WIs.length)
	for (let entrie of aret) delete entrie.isActived
	return aret
}
