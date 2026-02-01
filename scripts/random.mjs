import { shuffleArray } from './tools.mjs'

/**
 * 从给定的参数中随机选择一个并返回。
 * @param {...any} args - 一个或多个要从中选择的参数。
 * @returns {any} - 随机选择的参数。
 */
export function random(...args) {
	return args[Math.floor(Math.random() * args.length)]
}
/**
 * 从给定的参数中随机选择 N 个并返回。
 * @param {number} number - 要选择的参数数量。
 * @param {...any} args - 一个或多个要从中选择的参数。
 * @returns {any[]} - 随机选择的参数数组。
 */
export function PickRandomN(number, ...args) {
	return shuffleArray(args).slice(0, number)
}
/**
 * 将给定的字符串重复一个在最小和最大值之间的随机次数。
 * @param {string} str - 要重复的字符串。
 * @param {number} min - 最小重复次数。
 * @param {number} max - 最大重复次数。
 * @returns {string} - 重复后的字符串。
 */
export function repeatRandomTimes(str, min, max) {
	const time = Math.floor(Math.random() * (max - min) + min)
	return str.repeat(time)
}
/**
 * 通过调用一个函数 N 次来生成 N 个不同的结果。
 * @param {number} times - 要生成的结果数量。
 * @param {Function} lambda - 用于生成结果的函数。
 * @returns {any[]} - 包含 N 个不同结果的数组。
 */
export function NdiffResults(times, lambda) {
	const result = new Set()
	while (result.size < times) result.add(lambda())
	return [...result]
}
/**
 * 根据给定的几率返回一个空字符串，否则返回原始字符串。
 * @param {number} chance - 返回空字符串的几率 (0 到 1 之间)。
 * @param {string} [string=''] - 如果不返回空字符串，则返回此字符串。
 * @returns {string} - 空字符串或原始字符串。
 */
export function emptyForChance(chance, string = '') {
	return Math.random() < chance ? '' : string
}
