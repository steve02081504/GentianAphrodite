import { buildPromptStruct } from '../../../../../../src/public/shells/chat/src/server/prompt_struct.mjs'
import { noAISourceAvailable, OrderedAISourceCalling } from '../AISource/index.mjs'
import { buildLogicalResults } from '../prompt/logical_results/index.mjs'
import { coderunner } from './functions/coderunner.mjs'
import { detailThinking } from './functions/detail-thinking.mjs'
import { filesender } from './functions/filesender.mjs'
import { googlesearch } from './functions/googlesearch.mjs'
import { rolesettingfilter } from './functions/rolesettingfilter.mjs'
import { webbrowse } from './functions/webbrowse.mjs'
import { timer } from './functions/timer.mjs'
import { noAIreply } from './noAI/index.mjs'
import { compareTwoStrings as string_similarity } from 'npm:string-similarity'
import { inspect } from 'node:util'
import { file_change } from './functions/file-change.mjs'
/** @typedef {import("../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReply_t} chatReply_t */
/** @typedef {import("../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 *
 * @param {chatReply_t} result
 * @param {prompt_struct_t} prompt_struct
 * @param {number} max_forever_looping_num
 * @param {number} warning_forever_looping_num
 * @param {number} similarity_threshold
 * @returns {(entry: chatLogEntry_t) => void}
 */
export function getLongTimeLogAdder(result, prompt_struct, max_forever_looping_num = 6, warning_forever_looping_num = 4, similarity_threshold = 0.9) {
	const sim_check_before = []
	let forever_looping_num = 0
	/**
	 * @description
	 * This function is used to add a log entry to the character's additional chat log.
	 * It will also check if the AI has entered an infinite loop, and if so, throw an error and end the conversation.
	 * @param {chatLogEntry_t} entry The log entry to add.
	 */
	function AddLongTimeLog(entry) {
		entry.charVisibility = [prompt_struct.char_id]
		result?.logContextBefore?.push?.(entry)
		prompt_struct.char_prompt.additional_chat_log.push(entry)
		if (entry.role === 'char') {
			sim_check_before.forEach(item_before => {
				if (string_similarity(entry.content, item_before) > similarity_threshold)
					forever_looping_num++
			})
			sim_check_before.push(entry.content)
			if (forever_looping_num >= max_forever_looping_num)
				throw new Error('infinite loop by AI')
			else if (forever_looping_num >= warning_forever_looping_num)
				AddLongTimeLog({
					name: 'system',
					role: 'system',
					content: `\
警告：你好像陷入了无限循环，请尽快结束循环，否则系统将强制结束对话并在评估流程中扣分。
（剩余循环次数：${max_forever_looping_num - forever_looping_num}）
`
				})
		}
	}
	return AddLongTimeLog
}

/**
 * @param {chatReplyRequest_t} args
 * @returns {Promise<chatLogEntry_t>}
 */
export async function GetReply(args) {
	if (noAISourceAvailable()) return noAIreply(args)

	const prompt_struct = await buildPromptStruct(args)
	const logical_results = await buildLogicalResults(args, prompt_struct, 0)
	/** @type {chatLogEntry_t} */
	const result = {
		content: '',
		logContextBefore: [],
		logContextAfter: [],
		files: [],
		extension: {},
	}
	const AddLongTimeLog = getLongTimeLogAdder(result, prompt_struct)
	regen: while (true) {
		console.log('logical_results', logical_results)
		console.log('prompt_struct')
		console.log(inspect(prompt_struct, { depth: 4, colors: true }))
		const AItype = logical_results.in_assist ? 'expert' : logical_results.in_nsfw ? 'nsfw' : 'sfw'
		result.content = await OrderedAISourceCalling(AItype, async AI => {
			const result = await AI.StructCall(prompt_struct)
			if (!String(result).trim()) throw new Error('empty reply')
			return result
		})
		if (result.content.trim() == '<-<null>->') return null // AI skipped
		/** @type {(import('../../../../../../src/decl/PluginAPI.ts').RepalyHandler_t)[]} */
		const replyHandlers = [
			coderunner, filesender, detailThinking, googlesearch, webbrowse, rolesettingfilter, file_change, timer,
			...Object.values(args.plugins).map(plugin => plugin.interfaces.chat?.RepalyHandler)
		].filter(Boolean)
		for (const repalyHandler of replyHandlers)
			if (await repalyHandler(result, { ...args, AddLongTimeLog, prompt_struct }))
				continue regen
		break
	}
	return result
}
