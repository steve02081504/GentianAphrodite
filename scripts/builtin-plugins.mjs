import { extractPathCandidates } from '../../../../../../src/public/parts/plugins/file-operations/src/mentioned_files.mjs'
import { loadPart } from '../../../../../../src/server/parts_loader.mjs'
import { selectBuiltinPlugins, selectPlatformPlugin } from '../prompt/plugin-triggers.mjs'

import { lewd_words, rude_words } from './dict.mjs'
import { getScopedChatLog, match_keys } from './match.mjs'

/**
 * 在 buildPromptStruct 前装配本轮触发的插件；不修改角色配置或子代理显式插件集。
 * @param {object} args 回复请求。
 * @param {object} logicalResults 角色逻辑结果。
 * @returns {Promise<void>} 插件装配完成。
 */
export async function loadTriggeredPlugins(args, logicalResults) {
	const names = await selectBuiltinPlugins(args, logicalResults, { matchKeys: match_keys, extractPathCandidates, getScopedChatLog })
	const platformPlugin = await selectPlatformPlugin(args, { matchKeys: match_keys, rudeWords: rude_words, lewdWords: lewd_words })
	if (platformPlugin) names.push(platformPlugin)
	args.plugins ??= {}
	for (const name of names)
		args.plugins[name] ??= await loadPart(args.username, `plugins/${name}`)
	// code_execution 扩展只由宿主执行器消费；保留旧入口的隐式代码能力。
	if (args.plugins['fount-api'] || Object.values(args.plugins).some(plugin => plugin?.interfaces?.code_execution?.GetJSCodePrompt))
		args.plugins['code-execution'] ??= await loadPart(args.username, 'plugins/code-execution')
}
