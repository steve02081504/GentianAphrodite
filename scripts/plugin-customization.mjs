import { chardir } from '../charbase.mjs'
import { config } from '../config/index.mjs'
import { AIsources } from '../service_sources/AI.mjs'

import { unlockAchievement } from './achievements.mjs'
import { statisticDatas } from './statistics.mjs'
import { getVar, saveVar } from './vars.mjs'

/**
 * 订阅宿主插件的成功事件，更新角色成就与统计，不保留私有工具实现。
 * 持久化事件 id 防止复放的历史后台通知被每次回复重复计数。
 * @param {object} event 宿主插件事件。
 * @returns {void} 更新成就与统计。
 */
export function OnPluginEvent(event) {
	if (event.status !== 'succeeded' || !event.id) return
	let counter
	let achievement
	if (event.type === 'background') {
		if (event.tool === 'timer.callback') counter = 'timerCallbacks'
		else if (event.tool === 'browser-integration.callback') counter = 'browserCallbacks'
		else if (event.pluginName === 'code-execution') { counter = 'codeRuns'; achievement = 'use_coderunner' }
	} else if (event.type === 'tool')
		switch (event.pluginName) {
			case 'code-execution':
				if (/^(?:code-execution\.)?(?:run-|inline-)/.test(event.tool)) { counter = 'codeRuns'; achievement = 'use_coderunner' }
				break
			case 'file-operations': counter = 'fileOperations'; achievement = 'use_file_change'; break
			case 'web-search': counter = 'webSearches'; achievement = 'use_websearch'; break
			case 'web-browse': counter = 'webBrowses'; achievement = 'use_webbrowse'; break
			case 'timer': if (event.call?.tag === 'set-timer') counter = 'timersSet'; break
			case 'browser-integration': counter = 'browserOperations'; achievement = 'use_browser_integration'; break
		}

	if (!counter) return
	const seen = getVar('plugin-event-ids', {})
	if (seen[event.id]) return
	seen[event.id] = true
	statisticDatas.toolUsage ??= {}
	statisticDatas.toolUsage[counter] = (statisticDatas.toolUsage[counter] ?? 0) + 1
	if (achievement) unlockAchievement(achievement)
	saveVar('statistics', statisticDatas)
	saveVar('plugin-event-ids', seen)
}

/**
 * 按插件指定服务源；既有 web-browse 专用 AI 配置继续有效。
 * @param {object} args 插件与服务源请求。
 * @param {string} args.pluginName 宿主插件名称。
 * @param {string} args.serviceType 服务源类型。
 * @returns {object|string|undefined} 服务源覆盖；缺省继承宿主默认。
 */
export function GetPluginServiceSource({ pluginName, serviceType }) {
	const configured = config.pluginServiceSources?.[pluginName]?.[serviceType]
	if (configured) return configured
	if (serviceType === 'AI' && pluginName === 'web-browse') return AIsources['web-browse'] ?? undefined
}

/**
 * 追加角色上下文；主人保护由宿主按已验证归属处理，不重复工具说明。
 * @param {object} args 插件 prompt 请求。
 * @param {string} args.pluginName 宿主插件名称。
 * @returns {string|undefined} 附加角色上下文。
 */
export function GetPluginPrompt({ pluginName }) {
	if (['code-execution', 'file-operations'].includes(pluginName))
		return `龙胆的角色目录：${chardir}。`
}
