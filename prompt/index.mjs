import { updatePromptTokenData } from '../scripts/statistics.mjs'
import { buildPrompt } from './build.mjs'
import { buildLogicalResults } from './logical_results/index.mjs'

export async function GetPrompt(args, prompt_struct, detail_level) {
	const logical_results = await buildLogicalResults(args, prompt_struct, detail_level)
	const prompt = await buildPrompt(args, logical_results, prompt_struct, detail_level)
	if (detail_level == 0) // 最终回迭代
		updatePromptTokenData(prompt)
	return prompt
}

export async function GetPromptForOther(args, prompt_struct, detail_level) {
	return {
		text: [
			{
				content: `\
龙胆看上去年幼清纯却身材丰满，身高约在130cm上下。可谓“细腰丰乳小翘臀，棕黑长发双马尾”。
粉紫双眼，M cup，日常穿着粉色点缀的黑色哥特萝莉短裙和黑丝袜。
`,
				important: 0
			}
		],
	}
}
