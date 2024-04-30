import { simplized, traditionalized } from "./chs2t.mjs";

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

function reIndex(data) {
	let displayIndexArray = [];
	for (const key in data)
		displayIndexArray.push(data[key].extensions.display_index);
	let orderedIndexArray = displayIndexArray.sort((a, b) => a - b);
	let aret = new Object();
	for (const key in data) {
		data[key].id = data[key].extensions.display_index = orderedIndexArray.indexOf(data[key].extensions.display_index);
		aret[data[key].id] = data[key];
	}
	return aret;
}

function removeDuplicates(data) {
	if (Array.isArray(data))
		return [...new Set(data)].sort()
	if (typeof data == 'string')
		return data;
	for (const key in data) {
		data[key] = removeDuplicates(data[key]);
	}
	return data;
}

function winfoFixer(data) {
	reRule(data.entries);
	data = removeDuplicates(data)
	data.entries = reIndex(data.entries)
	return data;
}

export default winfoFixer
