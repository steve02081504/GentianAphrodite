import { ADPrompt } from './ads/index.mjs'
import { FunctionPrompt } from './functions/index.mjs'
import { MemoriesPrompt } from './memory/index.mjs'
import { mergePrompt } from './merge.mjs'
import { RoleSettingsPrompt } from './role_settings/index.mjs'
import { SystemPrompt } from './system/index.mjs'

/**
 * 构建最终的 Prompt。
 * @param {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {import("./logical_results/index.mjs").logical_results_t} logical_results - 逻辑结果。
 * @returns {Promise<object>} - 构建后的 Prompt 对象。
 */
export async function buildPrompt(args, logical_results) {
	return mergePrompt(
		MemoriesPrompt(args, logical_results),
		RoleSettingsPrompt(args, logical_results),
		await FunctionPrompt(args, logical_results), // await 因为函数提示词可能修改enable_prompts而向SystemPrompt传递音频或图片的包含信息
		ADPrompt(args, logical_results),
		SystemPrompt(args, logical_results)
	)
}
