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

let debug_WI = []
let log = () => {}

function buildKeyList(keys, isSensitive, isFullWordMatch) {
	return keys.map(key => {
		let regtest = parseRegexFromString(key)
		if (regtest) return regtest
		key = escapeRegExp(key)
		if (isFullWordMatch) key = `\\b${key}\\b`
		return new RegExp(key, isSensitive ? 'ug' : 'ugi')
	})
}
function isAnyMatch(/** @type {RegExp[]} */list, /** @type {string} */content) {
	//return list.some(key => key.test(content))
	for (let key of list) if (key.test(content)) return true
	log('ANY match failed at', list)
	return false
}
function isAllMatch(/** @type {RegExp[]} */list, /** @type {string} */content) {
	//return list.every(key => key.test(content))
	for (let key of list)
		if (!key.test(content)){
			log('ALL match failed at', key)
			return false
		}
	return true
}
function notAnyMatch(/** @type {RegExp[]} */list, /** @type {string} */content) {
	//return !isAnyMatch(list, content)
	for (let key of list)
		if (key.test(content)){
			log('NOT ANY match failed at', key)
			return false
		}
	return true
}
function notAllMatch(/** @type {RegExp[]} */list, /** @type {string} */content) {
	//return !isAllMatch(list, content)
	for (let key of list) if (!key.test(content)) return true
	log('NOT ALL match failed at', list)
	return false
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
			/** @type {{role:string,charname?:string,content:string}[]} */
			chatLog,
			/** @type {string[]} */
			recursion_WIs
		) => {
			let in_debug = debug_WI.includes(entrie.comment)
			log = () => {}
			if (in_debug)
				log = (...args) => console.log('WI', entrie.comment, ...args)
			let last_enabled_chat_length = chat_metadata.enabled_WI_entries.get(entrie) ?? 0
			if (entrie.extensions.delay && entrie.extensions.delay > chat_metadata.chat_log.length) {
				log(`in delay`)
				return false
			}
			if (entrie.extensions.sticky && last_enabled_chat_length + entrie.extensions.sticky >= chatLog.length) {
				log('in sticky')
				return true
			}
			if (entrie.extensions.cooldown && last_enabled_chat_length + entrie.extensions.cooldown <= chatLog.length) {
				log('in cooldown')
				return false
			}
			if (entrie.extensions.useProbability && seedrandom(
				entrie.keys.join() + entrie.secondary_keys.join() + entrie.content, { entropy: true }
			)() > entrie.extensions.probability / 100) {
				log('failed probability check')
				return false
			}
			let content = chatLog.slice(-scan_depth).map(e => (e.charname || e.role) + ': ' + e.content)
			if (!entrie.extensions.exclude_recursion) content = content.concat(recursion_WIs)
			content = '\x01' + content.join('\n\x01')
			log('content', [content]);
			[...entrie.keys, ...entrie.secondary_keys].forEach(key => {key.lastIndex = 0})
			if (isAnyMatch(entrie.keys, content)) {
				log('matched keys, checking secondary keys')
				if (entrie.secondary_keys.length === 0) {
					log('no secondary keys')
					return true
				}
				switch (entrie.extensions.selectiveLogic) {
					case world_info_logic.AND_ALL:
						return isAllMatch(entrie.secondary_keys, content)
					case world_info_logic.AND_ANY:
						return isAnyMatch(entrie.secondary_keys, content)
					case world_info_logic.NOT_ALL:
						return notAllMatch(entrie.secondary_keys, content)
					case world_info_logic.NOT_ANY:
						return notAnyMatch(entrie.secondary_keys, content)
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
	/** @type {number[]} Represents the delay levels for entries that are delayed until recursion */
	let availableRecursionDelayLevels = [...new Set(
		WIdata_copy.map(entry => Number(entry.extensions.delay_until_recursion))
	)].sort((a, b) => a - b);

	for (let currentRecursionDelayLevel of availableRecursionDelayLevels) {
		console.log(`entering recursion level`, currentRecursionDelayLevel)
		let new_entries
		do {
			let WIdata_new = [...WIdata_copy]
			new_entries = []
			for (let entrie of WIdata_copy)
				if (entrie.constant || entrie.isActived(chatLog, recursion_WIs)) {
					if (entrie.extensions.delay_until_recursion > currentRecursionDelayLevel) continue
					chat_metadata.enabled_WI_entries.set(entrie, chat_metadata.chat_log.length)
					if (is_WILogicNode(entrie.content)) console.log('WI Logic node', entrie.content, 'enabled')
					entrie.content = evaluateMacros(entrie.content, env)
					new_entries.push(entrie)
					WIdata_new = WIdata_new.filter(e => e !== entrie)
				}

			WIdata_copy = WIdata_new.filter(e => !e.extensions.exclude_recursion)
			recursion_WIs = recursion_WIs.concat(new_entries.filter(e => !e.extensions.prevent_recursion).map(e => e.content))
			aret = aret.concat(new_entries)
			console.log('new WI entries:', new_entries.filter(e => !is_WILogicNode(e.content)).map(e => e.comment))
		} while (new_entries.length)
	}

	for (let entrie of aret) delete entrie.isActived
	return aret
}
