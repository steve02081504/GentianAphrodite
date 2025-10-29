import fs from 'node:fs/promises'
import path from 'node:path'

import { getAISourceData, setAISourceData } from '../AISource/index.mjs'
import { chardir, charname, username } from '../charbase.mjs'
import { resetIdleTimer } from '../event_engine/on_idle.mjs'
import { checkVoiceSentinel, stopVoiceSentinel } from '../event_engine/voice_sentinel.mjs'
import { mergeTree } from '../scripts/tools.mjs'

/**
 * 获取配置界面的显示内容。
 * @returns {Promise<{html: string, js: string}>} - 包含 HTML 和 JavaScript 内容的对象。
 */
export async function GetConfigDisplayContent() {
	return {
		html: await fs.readFile(path.join(chardir, 'config', 'display.html'), 'utf-8'),
		js: await fs.readFile(path.join(chardir, 'config', 'display.mjs'), 'utf-8')
	}
}

/**
 * 存储 Bot 的核心配置，例如深度研究参数、空闲事件和语音哨兵的禁用状态。
 * @type {object}
 */
export const config = {
	deep_research: {
		max_planning_cycles: 4,
		initial_plan_max_retries: 5,
		summary_max_retries: 5,
		reasoning_interval: 3000
	},
	disable_idle_event: false,
	disable_voice_sentinel: false
}

/**
 * 获取当前配置数据。
 * @returns {object} - 包含当前配置数据的对象。
 */
export function GetData() {
	return {
		AIsources: getAISourceData(),
		deep_research: config.deep_research,
		disable_idle_event: config.disable_idle_event,
		disable_voice_sentinel: config.disable_voice_sentinel
	}
}
/**
 * 设置新的配置数据。
 * @param {object} data - 包含新配置数据的对象。
 */
export async function SetData(data) {
	if (data.AIsources) await setAISourceData(data.AIsources)
	Object.assign(config.deep_research, data.deep_research)

	config.disable_idle_event = data.disable_idle_event
	resetIdleTimer()

	config.disable_voice_sentinel = data.disable_voice_sentinel
	if (config.disable_voice_sentinel) stopVoiceSentinel()
	else checkVoiceSentinel()
}

/**
 * 设置当前角色的配置数据。
 * @param {object} data - 包含要设置的数据的对象。
 * @returns {Promise<any>} - `setPartData` 函数的返回值。
 */
export async function setMyData(data) {
	const { setPartData } = await import('../../../../../../src/public/shells/config/src/manager.mjs')
	return setPartData(username, 'chars', charname, mergeTree(await GetData(), data))
}
