import { buildPromptStruct } from '../../../../../../src/public/shells/chat/src/server/prompt_struct.mjs'
import { noAISourceAvailable, OrderedAISourceCalling } from '../AISource/index.mjs'
import { buildLogicalResults } from '../prompt/logical_results/index.mjs'
import { coderunner } from './coderunner.mjs'
import { noAIreply } from './noAI/index.mjs'

export async function GetReply(args) {
	if (noAISourceAvailable()) return noAIreply(args)

	let prompt_struct = await buildPromptStruct(args)
	let logical_results = buildLogicalResults(args, prompt_struct, 0)
	let result = ''
	while (true) {
		console.log('logical_results', logical_results)
		console.log('prompt_struct')
		console.dir(prompt_struct, { depth: 4 })
		let AItype = logical_results.in_assist ? 'expert' : logical_results.in_nsfw ? 'nsfw' : 'sfw'
		result = await OrderedAISourceCalling(AItype, AI => AI.StructCall(prompt_struct))
		if (await coderunner(result, prompt_struct)) continue
		break
	}
	return { content: result }
}
