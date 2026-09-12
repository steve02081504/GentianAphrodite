/**
 * 检查两个数组是否相等。
 * @param {Array} a - 第一个数组。
 * @param {Array} b - 第二个数组。
 * @returns {boolean} - 如果数组相等则返回 true，否则返回 false。
 */
export function arraysEqual(a, b) {
	if (a === b) return true
	if (!a || !b) return false
	if (a.length !== b.length) return false

	for (let i = 0; i < a.length; ++i)
		if (a[i] !== b[i]) return false
	return true
}

/**
 * 从数组或对象树中删除重复的条目。
 * @param {Object|Array} data - 包含要处理的条目的数据。
 * @returns {Object|Array} - 删除了重复条目的数据。
 */
export function removeDuplicates(data) {
	if (Object(data) instanceof String) return data
	for (const key in data)
		data[key] = removeDuplicates(data[key])

	if (Array.isArray(data))
		return [...new Set(data)].sort()
	return data
}

/**
 * 返回数组中最频繁出现的元素。
 * @template T
 * @param {T[]} arr - 要检查的数组。
 * @param {(obj:T) => any} [summarier=x=>x] - 一个函数，用于从数组元素中提取用于比较的值。
 * @returns {{element: T, count: number}} - 包含最频繁出现的元素和其出现次数的对象。
 */
export function findMostFrequentElement(arr, summarier = x => x) {
	const countMap = {}
	let maxCount = 0
	let mostFrequentElement

	arr.forEach(element => {
		const summary = String(summarier(element))
		countMap[summary] = (countMap[summary] || 0) + 1
		if (countMap[summary] > maxCount) {
			maxCount = countMap[summary]
			mostFrequentElement = element
		}
	})

	return {
		element: mostFrequentElement,
		count: maxCount
	}
}
