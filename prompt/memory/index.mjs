import { mergePrompt } from '../build.mjs'

import { LongTermMemoryPrompt, saveLongTermMemory } from './long-term-memory.mjs'
import { saveShortTermMemory, ShortTermMemoryPrompt } from './short-term-memory.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @returns {Promise<single_part_prompt_t>} 记忆组成的Prompt
 */
export async function MemoriesPrompt(args, logical_results) {
	const result = []
	result.push(ShortTermMemoryPrompt(args, logical_results))
	result.push(LongTermMemoryPrompt(args, logical_results))

	return mergePrompt(...result)
}

/**
 * 保存记忆
 */
export async function saveMemories() {
	await saveLongTermMemory()
	await saveShortTermMemory()
}
