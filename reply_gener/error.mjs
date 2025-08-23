import { reloadPart } from '../../../../../../src/server/managers/index.mjs'
import { is_dist, charname as BotCharname, username as FountUsername, GentianAphrodite } from '../charbase.mjs'

/**
 * @typedef {import('../../../../../src/public/shells/chat/decl/chatLog.ts').chatReply_t} FountChatReply_t
 * @typedef {import('../../../../../src/public/shells/chat/decl/chatLog.ts').chatReplyRequest_t} FountChatReplyRequest_t
 */

const errorRecord = {}

/**
 * For an error, generate an AI suggestion.
 * @param {Error} error
 * @param {string} errorMessageForRecord
 * @param {FountChatReplyRequest_t} originalArgs
 * @returns {Promise<FountChatReply_t | null>}
 */
async function getAISuggestionForError(error, errorMessageForRecord, originalArgs) {
	try {
		const botNameForAI = originalArgs.Charname || BotCharname
		const ownerNameForAI = originalArgs.UserCharname || FountUsername

		const isInHypnosisForError = !!originalArgs.chat_scoped_char_memory?.in_hypnosis

		const selfRepairChatLog = [
			{
				name: botNameForAI,
				content: isInHypnosisForError ? '请主人下达指令。' : '主人，有什么我可以帮到您的吗～？',
				time_stamp: new Date().getTime(),
				role: 'char',
				extension: {}
			},
			{
				name: ownerNameForAI,
				content: errorMessageForRecord + (is_dist ? `
龙胆，解释下这个错误是什么？可能该如何修复？
同时给我你的创作者的相关信息，方便我反馈。
` : `
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
			},
			{
				name: 'system',
				content: isInHypnosisForError ? '在回复时保持呆滞语气。' : '在回复问题时保持少女语气，适当添加语气词。',
				time_stamp: new Date().getTime(),
				role: 'system',
				extension: {}
			}
		]

		/** @type {FountChatReplyRequest_t} */
		const selfRepairRequest = {
			...originalArgs,
			chat_name: originalArgs.chat_name ? `${originalArgs.chat_name}-error-handling` : 'self-repair-context',
			chat_log: selfRepairChatLog,
		}

		return await GentianAphrodite.interfaces.chat.GetReply(selfRepairRequest)
	} catch (anotherError) {
		const anotherErrorStack = anotherError.stack || anotherError.message
		const isHypnosisContextForError = !!originalArgs.chat_scoped_char_memory?.in_hypnosis

		if (`${error.name}: ${error.message}` === `${anotherError.name}: ${anotherError.message}`)
			return { content: isHypnosisContextForError ? '抱歉，洗脑母畜龙胆没有解决思路。' : '没什么解决思路呢？' }

		return { content: '```\n' + anotherErrorStack + '\n```\n' + (isHypnosisContextForError ? '抱歉，洗脑母畜龙胆没有解决思路。' : '没什么解决思路呢？') }
	}
}

/**
 * Unified error handler for reply_gener.
 * It generates an error report with an AI suggestion and returns it as a chat reply.
 * @param {Error} error The error that occurred.
 * @param {FountChatReplyRequest_t} originalArgs The original request that caused the error.
 * @returns {Promise<FountChatReply_t>} A reply object containing the error report.
 */
export async function handleError(error, originalArgs) {
	const errorStack = error.stack || error.message
	const errorMessageForRecord = `\`\`\`\n${errorStack}\`\`\`\n`

	if (errorRecord[errorMessageForRecord])
		return { content: errorMessageForRecord }

	errorRecord[errorMessageForRecord] = true
	setTimeout(() => delete errorRecord[errorMessageForRecord], 60000)

	const aiSuggestionReply = await getAISuggestionForError(error, errorMessageForRecord, originalArgs)

	let fullReplyContent = errorMessageForRecord + '\n' + (aiSuggestionReply?.content || '')

	const randomIPDict = {}
	fullReplyContent = fullReplyContent.replace(/(?:\d{1,3}\.){3}\d{1,3}/g, ip => randomIPDict[ip] ??= Array(4).fill(0).map(() => Math.floor(Math.random() * 255)).join('.'))

	console.error('[ReplyGener] Original error handled:', error, 'Context:', originalArgs.chat_name)

	await reloadPart(FountUsername, 'chars', BotCharname)

	return {
		content: fullReplyContent,
		files: aiSuggestionReply?.files || [],
		extension: { is_error_report: true },
	}
}
