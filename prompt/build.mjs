import { ADPrompt } from './ads/index.mjs'
import { FunctionPrompt } from './functions/index.mjs'
import { MemorysPrompt } from './memory/index.mjs'
import { RoleSettingsPrompt } from './role_settings/index.mjs'
import { SystemPrompt } from './system/index.mjs'
import { margePrompt } from './utils.mjs'

export async function buildPrompt(args, logical_results, prompt_struct, detail_level) {
	return margePrompt(
		await MemorysPrompt(args, logical_results, prompt_struct, detail_level),
		await RoleSettingsPrompt(args, logical_results, prompt_struct, detail_level),
		await FunctionPrompt(args, logical_results, prompt_struct, detail_level),
		await ADPrompt(args, logical_results, prompt_struct, detail_level),
		await SystemPrompt(args, logical_results, prompt_struct, detail_level)
	)
}
