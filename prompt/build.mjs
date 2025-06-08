import { ADPrompt } from './ads/index.mjs'
import { FunctionPrompt } from './functions/index.mjs'
import { MemoriesPrompt } from './memory/index.mjs'
import { RoleSettingsPrompt } from './role_settings/index.mjs'
import { SystemPrompt } from './system/index.mjs'

export function mergePrompt(...prompts) {
	const result = {
		text: [],
		additional_chat_log: [],
		extension: {}
	}
	for (const prompt of prompts) {
		result.text = result.text.concat(prompt.text || [])
		result.additional_chat_log = result.additional_chat_log.concat(prompt.additional_chat_log || [])
		result.extension = Object.assign(result.extension, prompt.extension)
	}
	result.text = result.text.filter(text => text.content)
	result.additional_chat_log = result.additional_chat_log.filter(chat_log => chat_log.content)
	return result
}

export async function buildPrompt(args, logical_results, prompt_struct, detail_level) {
	return mergePrompt(
		await MemoriesPrompt(args, logical_results, prompt_struct, detail_level),
		await RoleSettingsPrompt(args, logical_results, prompt_struct, detail_level),
		await FunctionPrompt(args, logical_results, prompt_struct, detail_level),
		await ADPrompt(args, logical_results, prompt_struct, detail_level),
		await SystemPrompt(args, logical_results, prompt_struct, detail_level)
	)
}
