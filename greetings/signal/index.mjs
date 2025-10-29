/**
 * 根据语言环境提供一组常见的信令问候语。
 * @param {object} args - 包含语言环境和用户角色名称的参数对象。
 * @param {string[]} args.locales - 用户的语言环境数组。
 * @param {string} args.UserCharname - 用户的角色名称。
 * @returns {Promise<Array<object>>} - 包含问候语内容的 Promise 数组。
 */
async function commonGreetings(args) {
	switch (args.locales[0].split('-')[0]) {
		case 'zh':
			return (await import('./zh-CN.mjs')).commonGreetings(args)
		case 'en':
		default:
			return (await import('./en-US.mjs')).commonGreetings(args)
	}
}

/**
 * 提供信令问候语。
 * @param {object} args - 包含语言环境和用户角色名称的参数对象。
 * @param {string[]} args.locales - 用户的语言环境数组。
 * @param {string} args.UserCharname - 用户的角色名称。
 * @returns {Promise<Array<object>>} - 包含问候语内容的 Promise 数组。
 */
export function singalGreetings(args) {
	return commonGreetings(args)
}
