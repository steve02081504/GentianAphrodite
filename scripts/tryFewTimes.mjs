import { sleep } from "./tools.mjs"

const MaxRetries = 3
/**
 * 尝试执行一个函数几次，如果失败则等待一段时间后重试。
 * @param {Function} func - 要执行的函数。
 * @param {object} [options] - 选项。
 * @param {number} [options.times=MaxRetries] - 尝试次数。
 * @param {number} [options.WhenFailsWaitFor=2000] - 失败后等待的毫秒数。
 * @returns {Promise<any>} - 函数的返回值。
 */
export async function tryFewTimes(func, { times = MaxRetries, WhenFailsWaitFor = 2000 } = {}) {
	while (times--)
		try { return await func() }
		catch (error) {
			await sleep(WhenFailsWaitFor)
			if (!times) throw error
		}
}
