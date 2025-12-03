/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

import { match_keys } from '../../scripts/match.mjs'

/**
 * 生成角色生成器相关的 Prompt。
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑结果。
 * @returns {Promise<object>} - Prompt 对象。
 */
export async function CharGeneratorPrompt(args, logical_results) {
	let result = ''
	if (await match_keys(args, ['prompt', '卡', '提示词', '设定', '角色'], 'any'))
		result += `\
你拥有创建角色的能力，在需要时返回以下格式来得知如何使用，或获取有关角色的信息以回答问题：
<get-tool-info>character-generator</get-tool-info>
你还可以帮助用户创建用户人设，返回以下格式来得知如何使用，或获取有关用户人设的信息以回答问题：
<get-tool-info>persona-generator</get-tool-info>
`
	return {
		text: [{
			content: result,
			important: 0
		}],
	}
}
