import { simplized, traditionalized } from "./chs2t.mjs";
import { WorldInfoBook, WorldInfoEntry } from "./charData.mjs";

/**
 * Iterates WI data array and performs specific operations on it.
 * 1. If the key or secondary key contains Chinese characters, the match_whole_words property is set to false.
 * 2. Add the simplized and traditionalized versions of the key and secondary key to the key and secondary key arrays.
 * this function will not remove duplicates keys, use {@link removeDuplicates} function to remove them.
 * @param {WorldInfoEntry[]} data - The data containing entries to process.
 */
function reRule(data) {
	for (const id in data) {
		let entrie = data[id];
		for (const key of [...entrie.keys, ...entrie.secondary_keys]) {
			// 判断是否包含中日韩文字符
			if (/\p{Unified_Ideograph}/u.test(key))
				entrie.extensions.match_whole_words = false;
		}
		let keySet = [...entrie.keys];
		for (const key of keySet) {
			if (key.indexOf(' '))
				entrie.keys.push(key.replace(/\s+/g, ''));
			entrie.keys.push(simplized(key));
			entrie.keys.push(traditionalized(key));
		}
		let secondary_keysSet = [...entrie.secondary_keys];
		for (const key of secondary_keysSet) {
			if (key.indexOf(' '))
				entrie.secondary_keys.push(key.replace(/\s+/g, ''));
			entrie.secondary_keys.push(simplized(key));
			entrie.secondary_keys.push(traditionalized(key));
		}
	}
}

/**
 * Iterates WI data array and re-indexes the uid and display index property.
 * @param {WorldInfoEntry[]} data - The data containing entries to process.
 */
function reIndex(data) {
	let displayIndexArray = [];
	for (const key in data)
		displayIndexArray.push(data[key].extensions.display_index);
	let orderedIndexArray = displayIndexArray.sort((a, b) => a - b);
	let aret = [];
	for (const key in data) {
		data[key].id = data[key].extensions.display_index = orderedIndexArray.indexOf(data[key].extensions.display_index);
		aret[data[key].id] = data[key];
	}
	return aret;
}

/**
 * Removes duplicate entries from the array or object tree.
 * @param {Object|Array} data - The data containing entries to process.
 * @returns {Object|Array} The data with duplicate entries removed.
 */
function removeDuplicates(data) {
	if (typeof data == 'string') return data;
	for (const key in data) {
		data[key] = removeDuplicates(data[key]);
	}
	if (Array.isArray(data))
		return [...new Set(data)].sort()
	return data;
}

/**
 * do the common fixes on winfo datas.
 * @param {WorldInfoBook} data - The charbook data
 */
function winfoFixer(data) {
	reRule(data.entries);
	data = removeDuplicates(data)
	data.entries = reIndex(data.entries)
	return data;
}

export default winfoFixer
