import { WorldInfoBook, WorldInfoEntry } from "./charData.mjs"
/**
 * @typedef {object} WIjsonData
 * @property {{[key: `${number}`]: WIjsonEntry}} entries
 * @property {WorldInfoBook} originalData
 */
/**
 * Converts v2CharWIbook to WIjsonData
 * @param {WorldInfoBook} book
 * @returns {WIjsonData}
 */
export function v2CharWIbook2WIjson(book) {
	let aret = { entries: {}, originalData: book }
	for (let entrie of book.entries)
		aret.entries[entrie?.id] = entrie?.id != undefined ? v2CharWIentry2WIjsonEntry(entrie) : entrie
	return aret
}
/**
 * Converts WIjsonData to v2CharWIbook
 * @param {WIjsonData} json
 * @returns {WorldInfoBook}
 */
export function WIjson2v2CharWIbook(json) {
	let aret = { ...json.originalData, entries: [] }
	for (let id in json.entries)
		aret.entries[id] = WIjsonEntry2v2CharWIentry(json.entries[id])
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
	let aret = {
		key: entrie.keys,
		keysecondary: entrie.secondary_keys,
		comment: entrie.comment,
		content: entrie.content,
		constant: entrie.constant,
		vectorized: entrie.extensions?.vectorized,
		selective: entrie.selective,
		selectiveLogic: entrie.extensions?.selectiveLogic,
		addMemo: true,
		order: entrie.insertion_order,
		position: entrie.extensions?.position,
		disable: !entrie.enabled,
		excludeRecursion: entrie.extensions?.exclude_recursion,
		probability: entrie.extensions?.probability,
		useProbability: entrie.extensions?.useProbability,
		depth: entrie.extensions?.depth,
		group: entrie.extensions?.group,
		groupOverride: entrie.extensions?.group_override,
		groupWeight: entrie.extensions?.group_weight,
		scanDepth: entrie.extensions?.scan_depth,
		caseSensitive: entrie.extensions?.case_sensitive,
		matchWholeWords: entrie.extensions?.match_whole_words,
		useGroupScoring: entrie.extensions?.use_group_scoring,
		automationId: entrie.extensions?.automation_id,
		role: entrie.extensions?.position == 4 ? entrie.extensions?.role : null,
		uid: entrie.id,
		preventRecursion: entrie.extensions?.prevent_recursion,
		displayIndex: entrie.extensions?.display_index
	}
	if (entrie.tanji) {
		delete aret.content
		delete aret.keysecondary
		delete aret.key
		aret = {
			tanjix: '}}🤓{{//',
			...aret,
			tanjiy: '}}',
			key: entrie.keys,
			keysecondary: entrie.secondary_keys,
			content: entrie.content,
			tanjiz: '{{//'
		}
	}
	return aret
}
/**
 * convert WIjsonEntry to WorldInfoEntry
 * @param {WIjsonEntry} json
 * @returns {WorldInfoEntry}
 */
function WIjsonEntry2v2CharWIentry(json) {
	return {
		keys: json.key,
		secondary_keys: json.keysecondary,
		comment: json.comment,
		content: json.content,
		constant: json.constant,
		selective: json.selective,
		insertion_order: json.order,
		enabled: !json.disable,
		position: json.position == 0 ? "before_char" : "after_char",
		id: json.uid,
		extensions: {
			position: json.position,
			exclude_recursion: json.excludeRecursion,
			probability: json.probability,
			useProbability: json.useProbability,
			depth: json.depth,
			selectiveLogic: json.selectiveLogic,
			group: json.group,
			group_override: json.groupOverride,
			group_weight: json.groupWeight,
			prevent_recursion: json.preventRecursion,
			scan_depth: json.scanDepth,
			match_whole_words: json.matchWholeWords,
			use_group_scoring: json.useGroupScoring,
			case_sensitive: json.caseSensitive,
			automation_id: json.automationId,
			role: json.role || 0,
			display_index: json.displayIndex,
			vectorized: json.vectorized,
		}
	}
}
