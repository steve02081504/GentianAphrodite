import { update as enUS } from './en-US.mjs'
import { update as zhCN } from './zh-CN.mjs'

export async function UpdateInfo() {
	return {
		'zh-CN': await zhCN(),
		'en-US': await enUS(),
	}
}
