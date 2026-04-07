import { groupGreetings } from './group/index.mjs'
import { signalGreetings } from './signal/index.mjs'

/**
 * 获取指定索引的单人问候语。
 * @param {object} args - 生成问候语所需的参数。
 * @param {number} index - 要获取的问候语的索引。
 * @returns {Promise<string>} 返回指定索引的问候语。
 */
export async function GetGreeting(args, index) {
	return (await signalGreetings(args))[index]
}

/**
 * 获取指定索引的群组问候语。
 * @param {object} args - 生成问候语所需的参数。
 * @param {number} index - 要获取的问候语的索引。
 * @returns {Promise<string>} 返回指定索引的问候语。
 */
export async function GetGroupGreeting(args, index) {
	return (await groupGreetings(args))[index]
}
