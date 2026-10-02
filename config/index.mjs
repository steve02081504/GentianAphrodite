import fs from 'node:fs'
import path from 'node:path'

import { loadPart } from '../../../../../../src/server/parts_loader.mjs'
import { chardir, charname, username } from '../charbase.mjs'
import { resetIdleTimer } from '../event_engine/on-idle.mjs'
import { checkVoiceSentinel, stopVoiceSentinel } from '../event_engine/voice-sentinel.mjs'
import { mergeTree } from '../scripts/tools/index.mjs'
import { getAISourceData, setAISourceData } from '../service_sources/AI.mjs'
import { getTranslateSourceData, setTranslateSourceData } from '../service_sources/translate.mjs'

/**
 * 获取配置界面的显示内容。
 * @returns {Promise<{html: string, js: string}>} - 包含 HTML 和 JavaScript 内容的对象。
 */
export async function GetConfigDisplayContent() {
	return {
		html: await fs.promises.readFile(path.join(chardir, 'config', 'display.html'), 'utf-8'),
		js: await fs.promises.readFile(path.join(chardir, 'config', 'display.mjs'), 'utf-8')
	}
}

/** @type {Record<string, import("../../../../../../src/decl/pluginAPI.ts").pluginAPI_t>} */
export let plugins = {}

/**
 * 存储 Bot 的核心配置，例如空闲事件和语音哨兵的禁用状态。
 * @type {object}
 */
export const config = {
	pluginServiceSources: {},
	reality_channel_disables: {
		idle_event: false,
		voice_sentinel: false
	},
	reality_channel_notification_fallback_order: {
		idle: ['telegram', 'discord', 'system'],
		'voice-processing': ['system', 'telegram', 'discord']
	},
	disable_prompt: {
		camera: false
	},
}

/**
 * 获取当前配置数据。
 * @returns {object} - 包含当前配置数据的对象。
 */
export function GetData() {
	return {
		AIsources: getAISourceData(),
		translateSource: getTranslateSourceData(),
		plugins: Object.keys(plugins),
		pluginServiceSources: config.pluginServiceSources,
		reality_channel_disables: config.reality_channel_disables,
		reality_channel_notification_fallback_order: config.reality_channel_notification_fallback_order,
		disable_prompt: config.disable_prompt,
	}
}
/**
 * 设置新的配置数据。
 * @param {object} data - 包含新配置数据的对象。
 */
export async function SetData(data) {
	if (data.pluginServiceSources) config.pluginServiceSources = data.pluginServiceSources
	await setAISourceData(data.AIsources || getAISourceData())
	checkVoiceSentinel()
	await setTranslateSourceData(data.translateSource || getTranslateSourceData())
	if (data.plugins) plugins = Object.fromEntries(await Promise.all(data.plugins.map(async x => [x, await loadPart(username, 'plugins/' + x)])))

	if (data.reality_channel_disables) {
		Object.assign(config.reality_channel_disables, data.reality_channel_disables)
		resetIdleTimer()
		if (config.reality_channel_disables.voice_sentinel) stopVoiceSentinel()
		else checkVoiceSentinel()
	}

	for (const prop of Object.keys(config.reality_channel_notification_fallback_order))
		if (data.reality_channel_notification_fallback_order?.[prop])
			config.reality_channel_notification_fallback_order[prop] = data.reality_channel_notification_fallback_order[prop]

	if (data.disable_prompt) Object.assign(config.disable_prompt, data.disable_prompt)
}

/**
 * 设置当前角色的配置数据。
 * @param {object} data - 包含要设置的数据的对象。
 * @returns {Promise<any>} - `setPartData` 函数的返回值。
 */
export async function setMyData(data) {
	const { setPartData } = await import('../../../../../../src/public/parts/shells/config/src/manager.mjs')
	return setPartData(username, 'chars/' + charname, mergeTree(await GetData(), data))
}
