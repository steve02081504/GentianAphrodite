import { updatePromptTokenData } from '../scripts/statistics.mjs'

import { buildPrompt } from './build.mjs'
import { buildLogicalResults } from './logical_results/index.mjs'

/**
 * 获取完整的 prompt。
 * @param {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatReplyRequest_t} args - 生成 prompt 所需的参数。
 * @returns {Promise<{text: {content: string, important: number}[]}>} 返回生成的 prompt。
 */
export async function GetPrompt(args) {
	const logical_results = await buildLogicalResults(args)
	const prompt = await buildPrompt(args, logical_results)
	updatePromptTokenData(prompt)
	return prompt
}

/**
 * 获取用于其他角色的 prompt。
 * @param {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatReplyRequest_t} args - 生成 prompt 所需的参数。
 * @returns {Promise<{text: {content: string, important: number}[]}>} 返回生成的 prompt。
 */
export async function GetPromptForOther(args) {
	return {
		text: [
			{
				content: `\
龙胆看上去年幼清纯却身材丰满，身高约在130cm上下。可谓“细腰丰乳小翘臀，棕黑长发双马尾”。
粉紫双眼，M cup，日常穿着粉色点缀的黑色哥特萝莉短裙和黑丝袜。
`,
				important: 0
			}
		],
	}
}
