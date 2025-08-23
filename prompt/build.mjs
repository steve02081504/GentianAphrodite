import { ADPrompt } from './ads/index.mjs'
import { FunctionPrompt } from './functions/index.mjs'
import { MemoriesPrompt } from './memory/index.mjs'
import { RoleSettingsPrompt } from './role_settings/index.mjs'
import { SystemPrompt } from './system/index.mjs'

export async function mergePrompt(...prompts) {
	prompts = await Promise.all(prompts.filter(Boolean))
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
		MemoriesPrompt(args, logical_results, prompt_struct, detail_level),
		RoleSettingsPrompt(args, logical_results, prompt_struct, detail_level),
		await FunctionPrompt(args, logical_results, prompt_struct, detail_level), // await 因为函数提示词可能修改enable_prompts而向SystemPrompt传递音频或图片的包含信息
		ADPrompt(args, logical_results, prompt_struct, detail_level),
		SystemPrompt(args, logical_results, prompt_struct, detail_level)
	)
}
