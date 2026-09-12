import { isReplyToNonMaster } from '../../scripts/match.mjs'

import { grantLogicalAchievements } from './achievements.mjs'
import { classifyAssistIntent, classifySubassist, refineAssist } from './assist.mjs'
import { classifyFight } from './fight.mjs'
import { classifyHypnosis } from './hypnosis.mjs'
import { classifyLanguage } from './language.mjs'
import { classifyNsfw } from './nsfw.mjs'
import { classifyPromptInjection } from './prompt-injection.mjs'
import { classifyTopics } from './topics.mjs'

/**
 * 逻辑结果类型定义
 * @typedef {{
 *  in_multi_char_chat: boolean,
 * 	in_reply_to_master: boolean,
 * 	in_hypnosis: boolean,
 * 	in_assist: boolean,
 * 	in_subassist: boolean,
 * 	in_nsfw: boolean,
 * 	in_fight: boolean,
 * 	is_pure_chinese: boolean,
 * 	hypnosis_exit: boolean,
 * 	talking_about_ai_character: boolean,
 * 	talking_about_prompt_review: boolean,
 * 	prompt_input: boolean
 * }} logical_results_t
 */

/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * 构建逻辑结果
 * @param {chatReplyRequest_t} args 聊天回复请求
 * @returns {Promise<logical_results_t>} 逻辑结果
 */
export async function buildLogicalResults(args) {
	/** @type {logical_results_t} */
	const result = {
		in_multi_char_chat: args.UserUid || args.CharUid
			? new Set([args.CharUid, args.ReplyToUid, args.UserUid, ...args.chat_log.map(e => e.uid)].filter(Boolean)).size > 2
			: new Set([args.Charname, args.ReplyToCharname, args.UserCharname, ...args.chat_log.map(e => e.name)].filter(Boolean)).size > 2,
		in_reply_to_master: !isReplyToNonMaster(args),
		in_hypnosis: false,
		hypnosis_exit: false,
		in_assist: false,
		in_subassist: false,
		in_nsfw: false,
		is_pure_chinese: false,
		talking_about_ai_character: false,
		talking_about_prompt_review: false,
		prompt_input: false
	}

	await classifyPromptInjection(args, result)
	await classifyLanguage(args, result)
	await classifyHypnosis(args, result)
	await classifyTopics(args, result)
	await classifyAssistIntent(args, result)
	await classifyNsfw(args, result)
	await classifySubassist(args, result)
	await classifyFight(args, result)
	await refineAssist(args, result)
	grantLogicalAchievements(args, result)

	return result
}
