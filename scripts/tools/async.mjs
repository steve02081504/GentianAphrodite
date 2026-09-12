/**
 * 暂停执行指定的毫秒数。
 * @param {number} [ms=100] - 要暂停的毫秒数。
 * @returns {Promise<void>}
 */
export async function sleep(ms = 100) {
	return new Promise(resolve => setTimeout(resolve, ms))
}
