import { ADPrompt } from './ads/index.mjs'
import { FunctionPrompt } from './functions/index.mjs'
import { RoleSettingsPrompt } from './role_settings/index.mjs'
import { SystemPrompt } from './system/index.mjs'

export function margePrompt(...prompts) {
	let result = {
		text: [],
		additional_chat_log: [],
		extension: {}
	}
	for (let prompt of prompts) {
		result.text = result.text.concat(prompt.text || [])
		result.additional_chat_log = result.additional_chat_log.concat(prompt.additional_chat_log || [])
		result.extension = Object.assign(result.extension, prompt.extension)
	}
	result.text = result.text.filter(text => text.content)
	result.additional_chat_log = result.additional_chat_log.filter(chat_log => chat_log.content)
	return result
}

export function buildPrompt(args, logical_results, prompt_struct, detail_level) {
	return margePrompt(
		RoleSettingsPrompt(args, logical_results, prompt_struct, detail_level),
		FunctionPrompt(args, logical_results, prompt_struct, detail_level),
		ADPrompt(args, logical_results, prompt_struct, detail_level),
		SystemPrompt(args, logical_results, prompt_struct, detail_level)
	)
}
