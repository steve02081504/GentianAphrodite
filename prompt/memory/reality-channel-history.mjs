import { RealityChannel } from '../../event_engine/index.mjs'
import { createContextSnapshot } from '../../scripts/context.mjs'

/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * 给AI提供现实频道的历史Prompt。
 * @param {chatReplyRequest_t} args 聊天请求参数
 * @param {logical_results_t} logical_results 逻辑分析结果
 * @returns {Promise<single_part_prompt_t>} 由近期的现实频道记录组成的提示
 */
export async function RealityChannelHistoryPrompt(args, logical_results) {
	const recentHistory = RealityChannel.chat_log.slice(-5)
	const historyText = createContextSnapshot(recentHistory)

	let result = ''
	if (historyText.trim())
		result = `\
<reality_channel_history>\
以下是你最近在现实频道中的活动记录：\
${historyText}\
</reality_channel_history>\
`

	return {
		text: [{ content: result, important: 0 }],
		additional_chat_log: []
	}
}
