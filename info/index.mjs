import { update as enUS } from './en-US.mjs'
import { update as zhCN } from './zh-CN.mjs'

/**
 * 更新并返回所有支持语言的信息。
 * @returns {Promise<{[key: string]: any}>} 返回一个包含所有语言信息的对象。
 */
export async function UpdateInfo() {
	return {
		'zh-CN': await zhCN(),
		'en-US': await enUS(),
	}
}
