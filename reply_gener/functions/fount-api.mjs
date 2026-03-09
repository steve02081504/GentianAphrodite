/**
 * fount API 相关，给代码执行中的js功能提供fountHostUrl和fountApiKey变量。
 */

import { generateApiKey } from '../../../../../../../src/server/auth.mjs'
import { hosturl } from '../../../../../../../src/server/server.mjs'
import { charname, username } from '../../charbase.mjs'
import { config, setMyData } from '../../config/index.mjs'

/**
 * 确保当前角色的 fountApiKey 存在。
 * @returns {Promise<string>} fountApiKey。
 */
async function ensureApiKey() {
	if (!config.fountApiKey) {
		const { apiKey } = await generateApiKey(username, `fount api key for ${charname}`)
		await setMyData({ fountApiKey: apiKey })
	}
	return config.fountApiKey
}

/**
 * 供 GetJSCodeContext 使用：返回当前角色的 fountApiKey 和 fountHostUrl。
 * @returns {Promise<{fountApiKey: string, fountHostUrl: string}>} fountApiKey 和 fountHostUrl。
 */
export async function fountApiContext() {
	return {
		fountApiKey: await ensureApiKey(),
		fountHostUrl: hosturl
	}
}
