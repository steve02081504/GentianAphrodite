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
	for (const id in data) {
		let entrie = data[id]
		if (!entrie) continue
		entrie.extensions ??= {}
		entrie.extensions.exclude_recursion = true
		entrie.extensions.prevent_recursion = !is_WILogicNode(entrie.content)
		for (const key of [...entrie.keys, ...entrie.secondary_keys]) {
			if (is_WILogicNode(key)) continue // 跳过推理节点
			// 判断是否包含中日韩文字符
			if (/\p{Unified_Ideograph}/u.test(key))
				entrie.extensions.match_whole_words = false
		}
		let keySet = [...entrie.keys]
		let secondary_keysSet = [...entrie.secondary_keys]
		if (keySet.filter(is_WILogicNode).length) entrie.extensions.exclude_recursion = false
		if (secondary_keysSet.filter(is_WILogicNode).length)
			if (entrie.extensions.selectiveLogic == world_info_logic.AND_ALL || entrie.extensions.selectiveLogic == world_info_logic.AND_ANY)
				entrie.extensions.exclude_recursion = false;
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
	let displayIndexArray = []
	for (const key in data) {
		if (!data[key]) delete data[key]
		data[key].extensions ??= {}
		data[key].extensions.display_index ??= displayIndexArray[displayIndexArray.length - 1] + 1
		displayIndexArray.push(data[key].extensions.display_index)
	}
	let orderedIndexArray = displayIndexArray.sort((a, b) => a - b)
	let aret = []
	for (const key in data) {
		data[key].id = data[key].extensions.display_index = orderedIndexArray.indexOf(data[key].extensions.display_index)
		aret[data[key].id] = data[key]
	}
	return aret
}

/**
 * do the common fixes on winfo datas.
 * @param {WorldInfoBook} data - The charbook data
 */
function winfoFixer(data) {
	reRule(data.entries)
	data = removeDuplicates(data)
	data.entries = reIndex(data.entries)
	return data
}

export default winfoFixer
