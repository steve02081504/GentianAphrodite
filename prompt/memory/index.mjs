import { margePrompt } from '../utils.mjs'
import { saveShortTermMemory, ShortTermMemoryPrompt } from './short-term-memory.mjs'
import { LongTermMemoryPrompt, saveLongTermMemory } from './long-term-memory.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function MemorysPrompt(args, logical_results, prompt_struct, detail_level) {
	const result = []
	result.push(ShortTermMemoryPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(LongTermMemoryPrompt(args, logical_results, prompt_struct, detail_level))

	return margePrompt(...await Promise.all(result))
}

export async function saveMemorys() {
	await saveLongTermMemory()
	await saveShortTermMemory()
}
