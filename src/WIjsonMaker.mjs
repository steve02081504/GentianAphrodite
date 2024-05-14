import { WorldInfoBook, WorldInfoEntry } from "./charData.mjs";
/**
 * @typedef {object} WIjsonData
 * @property {{[key: `${number}`]: WIjsonEntry}} entries
 */
/**
 * Converts v2CharWIbook to WIjsonData
 * @param {WorldInfoBook} book
 * @returns {WIjsonData}
 */
export function v2CharWIbook2WIjson(book) {
	let aret = { entries: {} }
	for (let entrie of book.entries)
		aret.entries[entrie.id] = v2CharWIentry2WIjsonEntry(entrie)

	return aret
}
/**
* @typedef {object} WIjsonEntry
* @property {string[]} key
* @property {string[]} keysecondary
* @property {string} comment
* @property {string} content
* @property {boolean} constant
* @property {boolean} vectorized
* @property {boolean} selective
* @property {number} selectiveLogic
* @property {boolean} addMemo
* @property {number} order
* @property {number} position
* @property {boolean} disable
* @property {boolean} excludeRecursion
* @property {number} probability
* @property {boolean} useProbability
* @property {number} depth
* @property {string} group
* @property {boolean} groupOverride
* @property {number} groupWeight
* @property {number} scanDepth
* @property {boolean} caseSensitive
* @property {boolean} matchWholeWords
* @property {boolean} useGroupScoring
* @property {string} automationId
* @property {number} role
* @property {number} uid
* @property {boolean} preventRecursion
* @property {number} displayIndex
*/

/**
 * convert WorldInfoEntry to WIjsonEntry
 * @param {WorldInfoEntry} entrie
 * @returns {WIjsonEntry}
 */
function v2CharWIentry2WIjsonEntry(entrie) {
	return {
		key: entrie.keys,
		keysecondary: entrie.secondary_keys,
		comment: entrie.comment,
		content: entrie.content,
		constant: entrie.constant,
		vectorized: entrie.extensions.vectorized,
		selective: entrie.selective,
		selectiveLogic: entrie.extensions.selectiveLogic,
		addMemo: true,
		order: entrie.insertion_order,
		position: entrie.position,
		disable: !entrie.enabled,
		excludeRecursion: entrie.extensions.exclude_recursion,
		probability: entrie.extensions.probability,
		useProbability: entrie.extensions.useProbability,
		depth: entrie.extensions.depth,
		group: entrie.extensions.group,
		groupOverride: entrie.extensions.group_override,
		groupWeight: 100,
		scanDepth: entrie.extensions.scan_depth,
		caseSensitive: entrie.extensions.case_sensitive,
		matchWholeWords: entrie.extensions.match_whole_words,
		useGroupScoring: false,
		automationId: entrie.extensions.automation_id,
		role: entrie.extensions.role,
		uid: entrie.id,
		preventRecursion: entrie.extensions.prevent_recursion,
		displayIndex: entrie.extensions.display_index
	}
}
