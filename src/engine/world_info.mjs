import crypto from "crypto-js"
import seedrandom from "seedrandom"
import { world_info_logic, world_info_position, WorldInfoEntry, extension_prompt_roles } from "../charData.mjs"
import { chat_metadata } from "../prompt_builder.mjs"
import { deepCopy, escapeRegExp, parseRegexFromString } from "../tools.mjs"
import { evaluateMacros } from "./marco.mjs"
import { is_WILogicNode } from "../WILN.mjs"

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
		entrie.uuid = crypto.SHA256(entrie.keys.join() + entrie.secondary_keys.join() + entrie.content).toString()
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
			if (entrie.extensions.cooldown)
				if (last_enabled_chat_length + entrie.extensions.cooldown <= chatLog.length)
					return false
			if (entrie.extensions.useProbability) {
				const rng = seedrandom(entrie.uuid, { entropy: true })
				if (rng() > entrie.extensions.probability / 100) return false
			}
			let content = chatLog.slice(-scan_depth).map(e => (e.charname || e.role) + ': ' + e.content)
			if (!entrie.extensions.exclude_recursion) content = content.concat(recursion_WIs)
			content = content.join('\n\x01')
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
	/** @type {number[]} Represents the delay levels for entries that are delayed until recursion */
	let availableRecursionDelayLevels = [...new Set(
		WIdata_copy.map(entry => Number(entry.extensions.delay_until_recursion))
	)].sort((a, b) => a - b);

	for (let currentRecursionDelayLevel of availableRecursionDelayLevels) {
		console.log(`entering recursion level`, currentRecursionDelayLevel)
		do {
			recursion_WI_size = recursion_WIs.length
			let WIdata_new = [...WIdata_copy]
			let new_entries = []
			for (let entrie of WIdata_copy)
				if (entrie.constant || entrie.isActived(chatLog, recursion_WIs)) {
					if (entrie.extensions.delay_until_recursion > currentRecursionDelayLevel) continue
					chat_metadata.enabled_WI_entries[entrie.uuid] = chat_metadata.chat_log.length
					entrie.content = evaluateMacros(entrie.content, env)
					if (is_WILogicNode(entrie.content)) console.log('WI Logic node', entrie.content, 'enabled')
					else new_entries.push(entrie)
					if (!entrie.extensions.prevent_recursion) recursion_WIs.push(entrie.content)
					WIdata_new = WIdata_new.filter(e => e !== entrie)
				}

			WIdata_copy = WIdata_new.filter(e => !e.extensions.exclude_recursion)
			aret = aret.concat(new_entries)
			console.log('new WI entries:', new_entries.map(e => e.comment))
		} while (recursion_WI_size < recursion_WIs.length)
	}

	for (let entrie of aret) delete entrie.isActived
	return aret
}
