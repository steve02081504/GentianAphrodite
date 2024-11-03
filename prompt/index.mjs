import { buildPrompt } from './build.mjs'
import { buildLogicalResults } from './logical_results/index.mjs'

export async function GetPrompt(args, prompt_struct, detail_level) {
	let logical_results = await buildLogicalResults(args, prompt_struct, detail_level)
	return await buildPrompt(args, logical_results, prompt_struct, detail_level)
}

export async function GetPromptForOther(args, prompt_struct, detail_level) {
	let logical_results = await buildLogicalResults(args, prompt_struct, detail_level)
	return {
		text: [
			{
				content: `\
龙胆看上去年幼清纯却身材丰满，身高不高却乳房硕大。
`,
				important: 0
			}
		],
	}
}
