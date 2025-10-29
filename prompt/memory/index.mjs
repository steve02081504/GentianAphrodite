import { mergePrompt } from '../build.mjs'

import { LongTermMemoryPrompt, saveLongTermMemory } from './long-term-memory.mjs'
import { saveShortTermMemory, ShortTermMemoryPrompt } from './short-term-memory.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @param {prompt_struct_t} prompt_struct 提示结构
 * @param {number} detail_level 细节等级
 * @returns {Promise<prompt_struct_t>} 返回的提示结构
 */
export async function MemoriesPrompt(args, logical_results, prompt_struct, detail_level) {
	const result = []
	result.push(ShortTermMemoryPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(LongTermMemoryPrompt(args, logical_results, prompt_struct, detail_level))

	return mergePrompt(...result)
}

/**
 * 保存记忆
 */
export async function saveMemories() {
	await saveLongTermMemory()
	await saveShortTermMemory()
}
