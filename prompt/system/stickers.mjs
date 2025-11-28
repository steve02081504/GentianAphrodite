import fs from 'node:fs'

import { chardir } from '../../charbase.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @returns {Promise<single_part_prompt_t>} 核心规则Prompt
 */
export async function StickersPrompt(args, logical_results) {
	let result = ''

	if (args.supported_functions.files)
		result += `\
你可以使用以下贴纸来卖萌或嘲讽，一次只能一个：
${fs.readdirSync(chardir + '/public/imgs/stickers').map(i => i.slice(0, -5)).join(';')}
使用方法是<gentian-sticker>贴纸名</gentian-sticker>。
`

	return {
		text: [],
		additional_chat_log: [{
			name: 'system',
			role: 'system',
			content: result,
			files: []
		}]
	}
}
