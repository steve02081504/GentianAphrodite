import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import { inspect } from 'node:util'

import { compareTwoStrings as string_similarity } from 'npm:string-similarity'

import { buildPromptStruct } from '../../../../../../src/public/parts/shells/chat/src/prompt_struct.mjs'
import { defineToolUseBlocks } from '../../../../../../src/public/parts/shells/chat/src/stream.mjs'
import { noAISourceAvailable, OrderedAISourceCalling } from '../AISource/index.mjs'
import { chardir, is_dist } from '../charbase.mjs'
import { plugins } from '../config/index.mjs'
import { get_discord_api_plugin } from '../interfaces/discord/api.mjs'
import { getDiscordSticker } from '../interfaces/discord/sticker.mjs'
import { get_telegram_api_plugin } from '../interfaces/telegram/api.mjs'
import { getTelegramSticker } from '../interfaces/telegram/sticker.mjs'
import { buildLogicalResults } from '../prompt/logical_results/index.mjs'
import { saveShortTermMemoryAfterReply } from '../prompt/memory/short-term-memory.mjs'
import { unlockAchievement } from '../scripts/achievements.mjs'
import { match_keys } from '../scripts/match.mjs'
import { addNotifyAbleChannel } from '../scripts/notify.mjs'
import { newCharReplay, newUserMessage, saveStatisticDatas, statisticDatas } from '../scripts/statistics.mjs'

import { handleError } from './error.mjs'
import { browserIntegration } from './functions/browserIntegration.mjs'
import { CharGenerator, PersonaGenerator } from './functions/charGenerator.mjs'
import { coderunner, GetCoderunnerPreviewUpdater } from './functions/coderunner.mjs'
import { deepResearch } from './functions/deep-research.mjs'
import { file_change } from './functions/file-change.mjs'
import { getToolInfo } from './functions/getToolInfo.mjs'
import { IdleManagementHandler } from './functions/idle-management.mjs'
import { LongTermMemoryHandler } from './functions/long-term-memory.mjs'
import { rolesettingfilter } from './functions/rolesettingfilter.mjs'
import { ShortTermMemoryHandler } from './functions/short-term-memory.mjs'
import { timer } from './functions/timer.mjs'
import { webbrowse } from './functions/webbrowse.mjs'
import { websearch } from './functions/websearch.mjs'
import { noAIreply } from './noAI/index.mjs'

/** @typedef {import("../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReply_t} chatReply_t */
/** @typedef {import("../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * 获取一个用于添加长时间日志的函数，同时检测并防止AI无限循环。
 * @param {chatReply_t} result - 当前的聊天回复对象，日志条目将被添加到此对象。
 * @param {prompt_struct_t} prompt_struct - Prompt结构体，其中包含角色的附加聊天日志。
 * @param {number} [max_forever_looping_num=6] - 判断为无限循环的最大相似回复次数。
 * @param {number} [warning_forever_looping_num=4] - 发出无限循环警告的相似回复次数阈值。
 * @param {number} [similarity_threshold=0.9] - 用于判断回复是否相似的阈值。
 * @returns {(entry: chatLogEntry_t) => void} 一个函数，接受一个日志条目并将其添加到长时间日志中。
 */
export function getLongTimeLogAdder(result, prompt_struct, max_forever_looping_num = 6, warning_forever_looping_num = 4, similarity_threshold = 0.9) {
	const sim_check_before = []
	let forever_looping_num = 0
	/**
	 * 将日志条目添加到角色的附加聊天日志中。
	 * 同时会检查AI是否进入无限循环，如果是，则抛出错误并结束对话。
	 * @param {chatLogEntry_t} entry - 要添加的日志条目。
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
				throw new Error('infinite loop by AI') // 给龙胆：别删这个，真删了到循环时你就卡死了
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
 * 主回复生成函数。
 * 接收聊天请求，构建prompt，调用AI，处理AI返回的函数调用，并返回最终的聊天回复。
 * @param {chatReplyRequest_t} args - 聊天回复请求的参数。
 * @returns {Promise<chatReply_t>} - 一个包含生成回复的对象。
 */
export async function GetReply(args) {
	/** @type {chatReply_t} */
	const result = {
		content: '',
		logContextBefore: [],
		logContextAfter: [],
		files: [],
		extension: {},
	}
	if (noAISourceAvailable()) return Object.assign(result, noAIreply(args))
	try {
		// 注入角色插件
		args.plugins = Object.assign({}, plugins, args.plugins)
		args.plugins.discord_api ??= await get_discord_api_plugin()
		args.plugins.telegram_api ??= await get_telegram_api_plugin()
		const prompt_struct = await buildPromptStruct(args)
		prompt_struct.alternative_charnames = [
			'Gentian', /Gentian(•|·)Aphrodite/, '龙胆', /龙胆(•|·)阿芙萝黛蒂/
		]
		const logical_results = await buildLogicalResults(args, prompt_struct, 0)
		const AddLongTimeLog = getLongTimeLogAdder(result, prompt_struct)
		const last_entry = args.chat_log.slice(-1)[0]
		if (last_entry?.name == args.UserCharname && last_entry.role == 'user') {
			newUserMessage(last_entry.content, args.extension?.platform || 'chat')
			if (await match_keys(args, ['爱你'], 'user'))
				unlockAchievement('say_it_back')

			const today = new Date()
			const isApril16 = today.getMonth() === 3 && today.getDate() === 16 // Month is 0-indexed, so April is 3
			if (isApril16 && await match_keys(args, ['生日快乐', 'happy birthday'], 'user'))
				unlockAchievement('happy_birthday')

			if (await match_keys(args, [/(花|华)(萝|箩|罗)(蘑|磨|摩)/], 'user'))
				unlockAchievement('talk_about_sister')

			if (await match_keys(args, ['兰斯', '槊'], 'user'))
				unlockAchievement('talk_about_father')

			if (await match_keys(args, ['博蒙蒂亚'], 'user'))
				unlockAchievement('talk_about_mother')

			if (await match_keys(args, ['雪球'], 'user'))
				unlockAchievement('talk_about_snowball')

			if (await match_keys(args, ['steve02081504'], 'user'))
				unlockAchievement('talk_about_author')
		}
		// 构建更新预览管线
		args.generation_options ??= {}
		const oriReplyPreviewUpdater = args.generation_options?.replyPreviewUpdater
		/**
		 * 聊天回复预览更新管道。
		 * @type {import('../../../../../../src/public/parts/shells/chat/decl/chatLog.ts').CharReplyPreviewUpdater_t}
		 */
		let replyPreviewUpdater = (args, r) => oriReplyPreviewUpdater?.(r)
		for (const GetReplyPreviewUpdater of [
			defineToolUseBlocks([
				// File operations (file-change.mjs)
				{ start: '<view-file>', end: '</view-file>' },
				{ start: '<replace-file>', end: '</replace-file>' },
				{ start: /<override-file[^>]*>/, end: '</override-file>' },

				// Code execution (coderunner.mjs)
				{ start: '<run-js>', end: '</run-js>' },
				{ start: '<run-bash>', end: '</run-bash>' },
				{ start: '<run-pwsh>', end: '</run-pwsh>' },
				{ start: '<run-powershell>', end: '</run-powershell>' },
				{ start: '<run-cmd>', end: '</run-cmd>' },
				{ start: '<wait-screen>', end: '</wait-screen>' },

				// Memory management (long-term-memory.mjs & short-term-memory.mjs)
				{ start: '<add-long-term-memory>', end: '</add-long-term-memory>' },
				{ start: '<update-long-term-memory>', end: '</update-long-term-memory>' },
				{ start: '<delete-long-term-memory>', end: '</delete-long-term-memory>' },
				{ start: '<list-long-term-memory>', end: '</list-long-term-memory>' },
				{ start: '<view-long-term-memory-context>', end: '</view-long-term-memory-context>' },
				{ start: '<delete-short-term-memories>', end: '</delete-short-term-memories>' },

				// Web browsing (websearch.mjs & webbrowse.mjs)
				{ start: '<web-search>', end: '</web-search>' },
				{ start: '<web-browse>', end: '</web-browse>' },

				// Deep research (deep-research.mjs)
				{ start: '<deep-research>', end: '</deep-research>' },

				// Timer functions (timer.mjs)
				{ start: '<set-timer>', end: '</set-timer>' },
				{ start: '<list-timers>', end: '</list-timers>' },
				{ start: '<remove-timer>', end: '</remove-timer>' },

				// Browser integration (browserIntegration.mjs)
				{ start: '<browser-get-connected-pages>', end: '</browser-get-connected-pages>' },
				{ start: '<browser-get-focused-page-info>', end: '</browser-get-focused-page-info>' },
				{ start: '<browser-get-browse-history>', end: '</browser-get-browse-history>' },
				{ start: '<browser-get-page-html>', end: '</browser-get-page-html>' },
				{ start: '<browser-get-visible-html>', end: '</browser-get-visible-html>' },
				{ start: '<browser-send-danmaku-to-page>', end: '</browser-send-danmaku-to-page>' },
				{ start: '<browser-run-js-on-page>', end: '</browser-run-js-on-page>' },
				{ start: '<browser-add-autorun-script>', end: '</browser-add-autorun-script>' },
				{ start: '<browser-update-autorun-script>', end: '</browser-update-autorun-script>' },
				{ start: '<browser-remove-autorun-script>', end: '</browser-remove-autorun-script>' },
				{ start: '<browser-list-autorun-scripts>', end: '</browser-list-autorun-scripts>' },

				// Idle Management
				{ start: '<adjust-idle-weight>', end: '</adjust-idle-weight>' },
				{ start: '<postpone-idle>', end: '</postpone-idle>' },
				{ start: '<add-todo>', end: '</add-todo>' },
				{ start: '<delete-todo>', end: '</delete-todo>' },
				{ start: '<list-todos>', end: '</list-todos>' },

				// Character Generator
				{ start: '<get-tool-info>', end: '</get-tool-info>' },
				{ start: /<generate-char[^>]*>/, end: '</generate-char>' },
				{ start: /<generate-persona[^>]*>/, end: '</generate-persona>' },
			]),
			await GetCoderunnerPreviewUpdater(),
			...Object.values(args.plugins).map(plugin => plugin.interfaces?.chat?.GetReplyPreviewUpdater)
		].filter(Boolean))
			replyPreviewUpdater = GetReplyPreviewUpdater(replyPreviewUpdater)
		/**
		 * 更新回复预览。
		 * @param {reply_chunk_t} r - 来自 AI 的回复块。
		 * @returns {void}
		 */
		args.generation_options.replyPreviewUpdater = r => replyPreviewUpdater(args, r)
		regen: while (true) {
			if (!is_dist && process.env.EdenOS) {
				console.log('logical_results', logical_results)
				console.log('prompt_struct', inspect(prompt_struct, { depth: 4, colors: true }))
			}
			const AItype = args.extension?.source_purpose ?? (logical_results.in_reply_to_master ?
				logical_results.in_nsfw ? 'nsfw' : logical_results.in_assist ? 'expert' : 'sfw'
				: 'from-other')
			const requestresult = await OrderedAISourceCalling(AItype, async AI => {
				const result = await AI.StructCall(prompt_struct, args.generation_options)
				if (!String(result.content).trim()) throw new Error('empty reply')
				return result
			})
			result.content = requestresult.content
			result.files = result.files.concat(requestresult.files || [])
			result.extension = { ...result.extension, ...requestresult.extension }
			if (result.content.split('\n').pop().trim() == '<-<null>->') { // AI skipped
				const lastlog = prompt_struct.chat_log.slice(-1)[0]
				if (lastlog) {
					lastlog.logContextAfter ??= []
					lastlog.logContextAfter.push({
						name: '龙胆',
						role: 'char',
						content: '<-<null>->',
						charVisibility: [args.char_id]
					})
				}
				return null
			}
			if (result.content.split('\n').pop().trim() == '<-<error>->') { // AI throws error
				const lastlog = prompt_struct.chat_log.slice(-1)[0]
				if (lastlog) {
					lastlog.logContextAfter ??= []
					lastlog.logContextAfter.push({
						name: '龙胆',
						role: 'char',
						content: '<-<error>->',
						charVisibility: [args.char_id]
					})
				}
				throw Object.assign(new Error(), { skip_auto_fix: true, skip_report: true })
			}
			const sticker = result.content.match(/<gentian-sticker>(.*?)<\/gentian-sticker>/)?.[1]
			result.content = result.content.replace(/<gentian-sticker>(.*?)<\/gentian-sticker>/, '')
			if (sticker)
				if (args.extension?.platform === 'telegram')
					result.content += `\n${await getTelegramSticker(sticker)}`
				else if (args.extension?.platform === 'discord' && logical_results.in_muti_char_chat) // 在非群聊中用大图
					result.content += `\n${await getDiscordSticker(sticker)}`
				else try {
					result.files.push({
						name: sticker + '.avif',
						buffer: Buffer.from(fs.readFileSync(chardir + '/public/imgs/stickers/' + sticker + '.avif'), 'base64'),
						mime_type: 'image/avif'
					})
				} catch {
					console.error(`Sticker ${sticker} not found`)
				}
			result.content = result.content.replace(/\s*<-<(null|error)>->\s*$/, '')
			if (args.supported_functions.add_message) addNotifyAbleChannel(args)
			if (!result.content) return null
			/** @type {(import('../../../../../../src/decl/PluginAPI.ts').ReplyHandler_t)[]} */
			const replyHandlers = [
				getToolInfo, CharGenerator, PersonaGenerator,
				coderunner, LongTermMemoryHandler, ShortTermMemoryHandler,
				deepResearch, websearch, webbrowse, rolesettingfilter, file_change, browserIntegration, IdleManagementHandler,
				args.supported_functions.add_message ? timer : null,
				...Object.values(args.plugins).map(plugin => plugin.interfaces.chat?.ReplyHandler)
			].filter(Boolean)
			let continue_regen = false
			for (const replyHandler of replyHandlers)
				if (await replyHandler(result, {
					...args, AddLongTimeLog, prompt_struct, extension: {
						...args.extension,
						logical_results
					}
				}))
					continue_regen = true
			if (continue_regen) continue regen
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

		// 在回复完成后保存短期记忆（包含回复结果）
		await saveShortTermMemoryAfterReply(args, result)

		return result
	}
	catch (error) {
		console.error(`[ReplyGener] Error in GetReply for chat "${args.chat_name}":`, error)
		if (!error.skip_auto_fix) return handleError(error, args)
		else throw error
	}
}
