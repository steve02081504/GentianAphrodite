/**
 * 递归地创建给定对象的深层副本。
 * @template T
 * @param {T} object - 要复制的对象。
 * @param {WeakMap<object, object>} [weakMap] - 用于存储已复制对象的 WeakMap。
 * @returns {T} - 对象的深层副本。
 */
export function deepCopy(object, weakMap = new WeakMap()) {
	if (!object || !(object instanceof Object)) return object

	if (weakMap.has(object)) return weakMap.get(object)

	const target = Array.isArray(object) ? [] : {}
	weakMap.set(object, target)
	for (const key in object)
		if (Object.hasOwnProperty.call(object, key)) target[key] = deepCopy(object[key], weakMap)
	Object.setPrototypeOf(target, Object.getPrototypeOf(object))

	return target
}

/**
 * 递归地将两个对象合并到一个新对象中。
 * @template T, U
 * @param {T | null | undefined} obj1 - 要合并的第一个对象。
 * @param {U | null | undefined} obj2 - 要合并的第二个对象。
 * @param {WeakMap<object, object>} [weakMap] - 用于存储已复制对象的 WeakMap。
 * @returns {T & U} - 合并两个输入对象后产生的新对象。
 */
export function mergeTree(obj1, obj2, weakMap = new WeakMap()) {
	if (!obj1 || !(obj1 instanceof Object)) return obj2 ?? obj1
	if (obj1 instanceof String) return obj2 ?? obj1
	const target = deepCopy(obj1, weakMap)
	for (const key in obj2)
		if (Object.hasOwnProperty.call(obj2, key)) target[key] = mergeTree(obj1?.[key], obj2?.[key], weakMap)

	return target
}
