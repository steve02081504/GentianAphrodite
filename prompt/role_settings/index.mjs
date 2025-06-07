import { mergePrompt } from '../build.mjs'
import { AbilityPrompt } from './ability.mjs'
import { BackgroundPrompt } from './background.mjs'
import { BasedefPrompt } from './base_defs.mjs'
import { BodyDataPrompt } from './bodydata.mjs'
import { combatPrompt } from './combat.mjs'
import { corpusPrompt } from './corpus.mjs'
import { ItemsPrompt } from './items.mjs'
import { KnowledgePrompt } from './knowledge.mjs'
import { LikesPrompt } from './likes.mjs'
import { HypnosisExitPrompt, HypnosisModePrompt } from './modes/hypnosis.mjs'
import { NormalModePrompt } from './modes/normal.mjs'
import { OtherDetailPrompt } from './others.mjs'
import { SexPrompt } from './sex.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function RoleSettingsPrompt(args, logical_results, prompt_struct, detail_level) {
	const result = []
	result.push(corpusPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(BasedefPrompt(args, logical_results, prompt_struct, detail_level))
	if (!logical_results.in_hypnosis || logical_results.hypnosis_exit)
		result.push(NormalModePrompt(args, logical_results, prompt_struct, detail_level))
	else
		result.push(HypnosisModePrompt(args, logical_results, prompt_struct, detail_level))
	if (logical_results.hypnosis_exit)
		result.push(HypnosisExitPrompt(args, logical_results, prompt_struct, detail_level))

	result.push(AbilityPrompt(args, logical_results, prompt_struct, detail_level))

	if (!logical_results.in_assist && logical_results.in_reply_to_master)
		result.push(SexPrompt(args, logical_results, prompt_struct, detail_level))

	result.push(combatPrompt(args, logical_results, prompt_struct, detail_level))

	if (!logical_results.talking_about_prompt_review) {
		result.push(ItemsPrompt(args, logical_results, prompt_struct, detail_level))
		result.push(LikesPrompt(args, logical_results, prompt_struct, detail_level))
		result.push(BodyDataPrompt(args, logical_results, prompt_struct, detail_level))
	}

	result.push(OtherDetailPrompt(args, logical_results, prompt_struct, detail_level))
	result.push(KnowledgePrompt(args, logical_results, prompt_struct, detail_level))
	result.push(BackgroundPrompt(args, logical_results, prompt_struct, detail_level))

	return mergePrompt(...await Promise.all(result))
}
