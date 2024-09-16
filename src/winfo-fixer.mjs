import { WorldInfoBook, WorldInfoEntry, world_info_logic } from "./charData.mjs"
import { removeDuplicates } from "./tools.mjs"
import { is_common_key, is_WILogicNode } from "./WILN.mjs"

/**
 * Iterates WI data array and performs specific operations on it.
 * 1. If the key or secondary key contains Chinese characters, the match_whole_words property is set to false.
 * 2. Add the simplized and traditionalized versions of the key and secondary key to the key and secondary key arrays.
 * this function will not remove duplicates keys, use {@link removeDuplicates} function to remove them.
 * @param {WorldInfoEntry[]} data - The data containing entries to process.
 */
function reRule(data) {
	for (const entrie of data) {
		if (!entrie) continue
		entrie.extensions ??= {}
		entrie.extensions.exclude_recursion = true
		entrie.extensions.prevent_recursion = !is_WILogicNode(entrie.content)
		for (const key of [...entrie.keys, ...entrie.secondary_keys]) {
			if (is_WILogicNode(key)) {entrie.extensions.exclude_recursion = false; continue} // 跳过推理节点
			// 判断是否包含中日韩文字符
			if (/\p{Unified_Ideograph}/u.test(key))
				entrie.extensions.match_whole_words = false
		}
		let keySet = [...entrie.keys], secondary_keysSet = [...entrie.secondary_keys];
		[
			{
				set: keySet,
				array: entrie.keys
			},
			{
				set: secondary_keysSet,
				array: entrie.secondary_keys
			}
		].forEach(({ set, array }) => {
			set.filter(is_common_key).forEach(key => {
				if (key.indexOf(' '))
					array.push(key.replace(/\s+/g, ''))
			})
		})
	}
}

/**
 * Iterates WI data array and re-indexes the uid and display index property.
 * @param {WorldInfoEntry[]} data - The data containing entries to process.
 */
function reIndex(data) {
	let orderedIndexArray = Array.from({length: data.length}).map((v, i) => i)
	let aret = []
	data = data.sort((a, b) => a.extensions.display_index - b.extensions.display_index)
	for (const key in data) {
		data[key].extensions ??= {}
		data[key].extensions.display_index ??= 0
		let id = orderedIndexArray.indexOf(data[key].extensions.display_index)
		while (aret[id] || id < 0) id++
		data[key].id = data[key].extensions.display_index = id
		aret[id] = data[key]
	}
	return aret
}

/**
 * Iterates WI data array and sets the scan order property.
 * @param {WorldInfoEntry[]} data - The data containing entries to process.
 */
function setScanOrder(data) {
	for (const entrie of data) delete entrie.extensions.delay_until_recursion
	let get_scan_order = entrie => {
		if (entrie.extensions.delay_until_recursion === undefined) {
			let deps = [...entrie.keys, ...entrie.secondary_keys].filter(is_WILogicNode).map(
				x => data.filter(y => y.content == x)[0]
			)
			entrie.extensions.delay_until_recursion = Math.max(-1, ...deps.map(get_scan_order)) + 1
		}
		return entrie.extensions.delay_until_recursion
	}
	data.map(get_scan_order)
}

/**
 * do the common fixes on winfo datas.
 * @param {WorldInfoBook} data - The charbook data
 */
function winfoFixer(data) {
	reRule(data.entries)
	data = removeDuplicates(data)
	setScanOrder(data.entries)
	data.entries = reIndex(data.entries)
	return data
}

export default winfoFixer
