import { buildPromptStruct } from '../../../../../../src/public/shells/chat/src/server/prompt_struct.mjs'
import { noAISourceAvailable, OrderedAISourceCalling } from '../AISource/index.mjs'
import { buildLogicalResults } from '../prompt/logical_results/index.mjs'
import { coderunner } from './functions/coderunner.mjs'
import { detailThinking } from './functions/detail-thinking.mjs'
import { googlesearch } from './functions/googlesearch.mjs'
import { rolesettingfilter } from './functions/rolesettingfilter.mjs'
import { webbrowse } from './functions/webbrowse.mjs'
import { timer } from './functions/timer.mjs'
import { noAIreply } from './noAI/index.mjs'
import { compareTwoStrings as string_similarity } from 'npm:string-similarity'
import { file_change } from './functions/file-change.mjs'
import { LongTermMemoryHandler } from './functions/long-term-memory.mjs'
import { ShortTermMemoryHandler } from './functions/short-term-memory.mjs'
import { addNotifyAbleChannel } from '../scripts/notify.mjs'
import { inspect } from 'node:util'
import { newCharReplay, newUserMessage, saveStatisticDatas, statisticDatas } from '../scripts/statistics.mjs'
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
 * @returns {Promise<chatReply_t>}
 */
export async function GetReply(args) {
	if (noAISourceAvailable()) return noAIreply(args)

	const prompt_struct = await buildPromptStruct(args)
	prompt_struct.alternative_charnames = [
		'Gentian', /Gentian(•|·)Aphrodite/, '龙胆', /龙胆(•|·)阿芙萝黛蒂/
	]
	const logical_results = await buildLogicalResults(args, prompt_struct, 0)
	/** @type {chatReply_t} */
	const result = {
		content: '',
		logContextBefore: [],
		logContextAfter: [],
		files: [],
		extension: {},
	}
	const AddLongTimeLog = getLongTimeLogAdder(result, prompt_struct)
	const last_entry = args.chat_log.slice(-1)[0]
	if (last_entry?.name == args.UserCharname && last_entry.role == 'user')
		newUserMessage(last_entry.content, args.extension?.platform || 'chat')
	regen: while (true) {
		if (globalThis.fountCharCI?.echo_prompt_struct || process.env.EdenOS) {
			console.log('logical_results', logical_results)
			console.log('prompt_struct', inspect(prompt_struct, { depth: 4, colors: true }))
		}
		const AItype = logical_results.in_reply_to_master ? 
			logical_results.in_nsfw ? 'nsfw' : logical_results.in_assist ? 'expert' : 'sfw'
		 : 'from-other'
		const requestresult = await OrderedAISourceCalling(AItype, async AI => {
			const result = await AI.StructCall(prompt_struct)
			if (!String(result.content).trim()) throw new Error('empty reply')
			return result
		})
		result.content = requestresult.content
		result.files = result.files.concat(requestresult.files || [])
		if (result.content.split('\n').pop().trim() == '<-<null>->') { // AI skipped
			const lastlog = prompt_struct.chat_log.slice(-1)[0]
			lastlog.logContextAfter ??= []
			lastlog.logContextAfter.push({
				name: '龙胆',
				role: 'char',
				content: '<-<null>->',
				charVisibility: [args.char_id]
			})
			return null
		}
		result.content = result.content.replace(/\s*<-<null>->\s*$/, '')
		result.content = result.content.replace(/^(.|啊啦|唔姆|\.{3}){0,5}主人(大人)?(\.{3}|…|💖|✨|🥰|🎶|🥺|，|！|。)+/, '') // 啊啊啊啊我受不了了
		if (args.supported_functions.add_message) addNotifyAbleChannel(args)
		if (!result.content) return null
		/** @type {(import('../../../../../../src/decl/PluginAPI.ts').ReplyHandler_t)[]} */
		const replyHandlers = [
			coderunner, LongTermMemoryHandler, ShortTermMemoryHandler,
			detailThinking, googlesearch, webbrowse, rolesettingfilter, file_change,
			args.supported_functions.add_message ? timer : null,
			...Object.values(args.plugins).map(plugin => plugin.interfaces.chat?.ReplyHandler)
		].filter(Boolean)
		for (const replyHandler of replyHandlers)
			if (await replyHandler(result, {
				...args, AddLongTimeLog, prompt_struct, extension: {
					...args.extension,
					logical_results
				}
			}))
				continue regen
		break
	}
	if (last_entry?.name == args.UserCharname && last_entry.role == 'user') {
		if (logical_results.in_nsfw)
			statisticDatas.userActivity.NsfwMessagesSent++
		if (logical_results.in_hypnosis && !logical_results.hypnosis_exit)
			statisticDatas.userActivity.InHypnosisMessagesSent++
		newCharReplay(result.content, args.extension?.platform || 'chat')
		if (!statisticDatas.firstInteraction.time) {
			statisticDatas.firstInteraction = {
				time: Date.now(),
				userMessageContent: last_entry.content,
				characterReplyContent: result.content,
				chat_name: args.chat_name
			}
			saveStatisticDatas()
		}
	}
	return result
}
