import { world_info_logic } from "./charData.mjs";

let keyscorespliter = "__worldinfo_keyscores__"

/**
 * add key scores to the data
 * @param {WorldInfoEntry[]} data - The charbook data
 */
function keyScoreAdder(data) {
	for (const id in data) {
		let entrie = data[id];
		if (entrie?.extensions?.selectiveLogic == undefined) {
			console.error('selectiveLogic not found: ', entrie);
			continue
		}
		if (entrie.extensions.selectiveLogic == world_info_logic.AND_ALL || entrie.extensions.selectiveLogic == world_info_logic.AND_ANY)
			continue
		do {
			let secondary_keysSet = [...entrie.secondary_keys];
			let oldlen = entrie.secondary_keys.length;
			for (const key of secondary_keysSet) {
				if (key.startsWith('<-<') && key.endsWith('>->')) {
					let keyscore = data.filter(e => e.content == key)[0];
					if (!keyscore) {
						console.log(`keyscore not found: ${key}`);
						continue
					}
					entrie.secondary_keys.push(keyscorespliter);
					entrie.secondary_keys = entrie.secondary_keys.concat(keyscore.keys);
				}
			}
			entrie.secondary_keys = [...new Set(entrie.secondary_keys)];
			if (oldlen == entrie.secondary_keys.length) break
		} while (true)
	}
}
/**
 * remove key scores from the data
 * @param {WorldInfoEntry[]} data - The charbook data
 */
function keyScoreRemover(data) {
	for (const id in data) {
		let entrie = data[id];
		let index = entrie.secondary_keys.findIndex(x => x == keyscorespliter);
		if (index > -1) // 移除keyscorespliter及其后的所有元素
			entrie.secondary_keys = entrie.secondary_keys.slice(0, index)
	}
}

export { keyScoreAdder, keyScoreRemover, keyscorespliter }
