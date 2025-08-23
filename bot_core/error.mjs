import { localhostLocales } from '../../../../../../src/scripts/i18n.mjs'
import { reloadPart } from '../../../../../../src/server/managers/index.mjs'
import { loadDefaultPersona } from '../../../../../../src/server/managers/persona_manager.mjs'
import { is_dist, charname as BotCharname, username as FountUsername, GentianAphrodite } from '../charbase.mjs'

import { sendAndLogReply } from './reply.mjs'
import { errorRecord, userIdToNameMap, inHypnosisChannelId } from './state.mjs'

/**
 * Fount 聊天回复对象类型。
 * @typedef {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatReply_t} FountChatReply_t
 */

/**
 * Fount 聊天回复请求对象类型。
 * @typedef {import('../../../../../../src/public/shells/chat/decl/chatLog.ts').chatReplyRequest_t} FountChatReplyRequest_t
 */

/**
 * 平台接口 API 对象类型定义。
 * @typedef {import('./index.mjs').PlatformAPI_t} PlatformAPI_t
 */

/**
 * 扩展的 Fount 聊天日志条目类型，包含平台特定信息。
 * @typedef {import('./state.mjs').chatLogEntry_t_ext} chatLogEntry_t_ext
 */

/**
 * 为错误生成 AI 建议。
 * @async
 * @param {Error} error - 发生的错误对象。
 * @param {string} errorMessageForRecord - 格式化后的错误消息，用于记录和 AI 输入。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {chatLogEntry_t_ext | undefined} contextMessage - (可选) 发生错误时的上下文消息条目。
 * @returns {Promise<FountChatReply_t | null>} AI 生成的回复建议，或在无法生成时返回 null。
 */
async function getAISuggestionForError(error, errorMessageForRecord, platformAPI, contextMessage) {
	try {
		const botPlatformId = platformAPI.getBotUserId()
		const fountBotDisplayName = (await GentianAphrodite.getPartInfo?.(localhostLocales[0]))?.name || BotCharname
		const botNameForAI = userIdToNameMap[botPlatformId] || `${platformAPI.getBotUsername()} (咱自己)` || `${fountBotDisplayName} (咱自己)`

		const ownerPlatformUsername = platformAPI.getOwnerUserName()
		const ownerPlatformId = platformAPI.getOwnerUserId()
		const ownerNameForAI = userIdToNameMap[ownerPlatformId] || ownerPlatformUsername || FountUsername

		const currentChannelId = contextMessage?.extension?.platform_channel_id
		const isInHypnosisForError = !!(currentChannelId && currentChannelId === inHypnosisChannelId)

		const selfRepairChatLog = [
			{
				name: botNameForAI,
				content: isInHypnosisForError ? '请主人下达指令。' : '主人，有什么我可以帮到您的吗～？',
				time_stamp: new Date().getTime(),
				role: 'char',
				extension: {}
			}, {
				name: ownerNameForAI,
				content: errorMessageForRecord + (is_dist ? `\
龙胆，解释下这个错误是什么？可能该如何修复？
同时给我你的创作者的相关信息，方便我反馈。
`: `\
龙胆，我该如何解决这个错误？可以的话你来直接修复它。
注意的点：
- 以修正出问题的文件为主，宏观上没什么好修复的
- fount项目基于deno，没有package.json
- 不要删除整个项目并重新下载，那会删除你自己和我的用户配置
- 不能修复也没问题，帮我分析下报错也可以，不会怪你
`),
				time_stamp: new Date().getTime(),
				role: 'user',
				extension: {}
			}, {
				name: 'system',
				content: isInHypnosisForError ? '在回复时保持呆滞语气。' : '在回复问题时保持少女语气，适当添加语气词。',
				time_stamp: new Date().getTime(),
				role: 'system',
				extension: {}
			}
		]

		const chatNameForSelfRepair = platformAPI.getChatNameForAI(
			currentChannelId || (is_dist ? 'error-report-context' : 'self-repair-context'),
			contextMessage
		)

		/** @type {FountChatReplyRequest_t} */
		const selfRepairRequest = {
			supported_functions: { markdown: true, mathjax: true, html: false, unsafe_html: false, files: true, add_message: false },
			username: FountUsername,
			chat_name: chatNameForSelfRepair,
			char_id: BotCharname,
			Charname: botNameForAI,
			UserCharname: ownerNameForAI,
			locales: localhostLocales,
			time: new Date(),
			world: platformAPI.getPlatformWorld(),
			user: loadDefaultPersona(FountUsername),
			char: GentianAphrodite,
			other_chars: [],
			plugins: {},
			chat_scoped_char_memory: {},
			chat_log: selfRepairChatLog,
			extension: { platform: contextMessage?.extension?.platform || 'unknown' }
		}
		return await GentianAphrodite.interfaces.chat.GetReply(selfRepairRequest)
	} catch (anotherError) {
		const anotherErrorStack = anotherError.stack || anotherError.message
		const currentChannelId = contextMessage?.extension?.platform_channel_id
		const isHypnosisContextForError = !!(inHypnosisChannelId && currentChannelId && currentChannelId === inHypnosisChannelId)

		if (`${error.name}: ${error.message}` === `${anotherError.name}: ${anotherError.message}`)
			return { content: isHypnosisContextForError ? '抱歉，洗脑母畜龙胆没有解决思路。' : '没什么解决思路呢？' }

		return { content: '```\n' + anotherErrorStack + '\n```\n' + (isHypnosisContextForError ? '抱歉，洗脑母畜龙胆没有解决思路。' : '没什么解决思路呢？') }
	}
}

/**
 * 发送错误报告。
 * @async
 * @param {string} fullReplyContent - 包含错误信息和 AI 建议的完整回复内容。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {Error} originalError - 原始错误对象。
 * @param {chatLogEntry_t_ext | undefined} contextMessage - (可选) 发生错误时的上下文消息条目。
 */
async function sendErrorReport(fullReplyContent, platformAPI, originalError, contextMessage) {
	try {
		if (contextMessage?.extension?.platform_channel_id)
			await sendAndLogReply({ content: fullReplyContent }, platformAPI, contextMessage.extension.platform_channel_id, undefined)
		else
			platformAPI.logError(new Error('[BotLogic] Error occurred (no context channel to reply): ' + fullReplyContent.substring(0, 1000) + '...'), undefined)

	} catch (sendError) {
		platformAPI.logError(sendError, contextMessage)
		console.error('[BotLogic] Failed to send error notification. Original error:', originalError, 'Send error:', sendError)
	}
}

/**
 * 统一错误处理函数。
 * @async
 * @param {Error} error - 发生的错误对象。
 * @param {PlatformAPI_t} platformAPI - 当前平台的 API 对象。
 * @param {chatLogEntry_t_ext | undefined} contextMessage - (可选) 发生错误时的上下文消息条目。
 */
export async function handleError(error, platformAPI, contextMessage) {
	const errorStack = error.stack || error.message
	const errorMessageForRecord = `\`\`\`\n${errorStack}\n\`\`\``

	if (errorRecord[errorMessageForRecord]) return
	errorRecord[errorMessageForRecord] = true
	setTimeout(() => delete errorRecord[errorMessageForRecord], 60000)

	const aiSuggestionReply = await getAISuggestionForError(error, errorMessageForRecord, platformAPI, contextMessage)

	let fullReplyContent = errorMessageForRecord + '\n' + (aiSuggestionReply?.content || '')
	const randomIPDict = {}
	fullReplyContent = fullReplyContent.replace(/(?:\d{1,3}\.){3}\d{1,3}/g, ip => randomIPDict[ip] ??= Array(4).fill(0).map(() => Math.floor(Math.random() * 255)).join('.'))

	await sendErrorReport(fullReplyContent, platformAPI, error, contextMessage)

	platformAPI.logError(error, contextMessage)
	console.error('[BotLogic] Original error handled:', error, 'Context:', contextMessage)
	await reloadPart(FountUsername, 'chars', BotCharname)
}
