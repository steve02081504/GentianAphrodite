/**
 * 返回 `y` (含) 和 `x` (不含) 之间的一个随机整数。
 * @param {number} x - 最大值。
 * @param {number} [y=0] - 最小值。
 * @param {Function} [Rng=Math.random] - 随机数生成器。
 * @returns {number} - `y` (含) 和 `x` (不含) 之间的一个随机整数。
 */
export function RandIntLessThan(x, y = 0, Rng = Math.random) { return Math.floor(Rng() * (x - y)) + y }

/**
 * 使用 Fisher-Yates 算法打乱数组的元素。
 * @template T
 * @param {Array<T>} a - 要打乱的数组。
 * @param {Function} [Rng=Math.random] - 随机数生成器。
 * @returns {Array<T>} - 打乱后的数组。
 */
export function shuffleArray(a, Rng = Math.random) {
	let currentIndex = a.length

	while (currentIndex) {
		const randomIndex = RandIntLessThan(currentIndex, 0, Rng)
		currentIndex--;
		[a[currentIndex], a[randomIndex]] = [a[randomIndex], a[currentIndex]]
	}
	return a
}
