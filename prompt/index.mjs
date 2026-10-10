import { is_dist } from '../charbase.mjs'
import { updatePromptTokenData } from '../scripts/statistics.mjs'

import { buildPrompt } from './build.mjs'
import { buildLogicalResults } from './logical_results/index.mjs'

/**
 * 获取完整的 prompt。
 * @param {import('../../../../../../src/public/parts/shells/chat/decl/chatLog.ts').chatReplyRequest_t} args - 生成 prompt 所需的参数。
 * @returns {Promise<{encrypted?: boolean, text: {content: string, important: number}[]}>} 返回生成的 prompt。
 */
export async function GetPrompt(args) {
	const logical_results = await buildLogicalResults(args)
	const prompt = await buildPrompt(args, logical_results)
	if (is_dist) prompt.encrypted = true
	// 子代理生成链（extension.subAgent 存在）不计入主会话的 prompt token 统计
	if (!args.extension?.subAgent) updatePromptTokenData(prompt)
	return prompt
}
