import { buildPromptStruct } from '../../../../../../src/public/shells/chat/src/server/prompt_struct.mjs'
import { noAISourceAvailable, OrderedAISourceCalling } from '../AISource/index.mjs'
import { buildLogicalResults } from '../prompt/logical_results/index.mjs'
import { coderunner } from './coderunner.mjs'
import { filesender } from './filesender.mjs'
import { noAIreply } from './noAI/index.mjs'
/** @typedef {import("../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */

/**
 * @param {chatReplyRequest_t} args
 * @returns {Promise<chatLogEntry_t>}
 */
export async function GetReply(args) {
	if (noAISourceAvailable()) return noAIreply(args)

	let prompt_struct = await buildPromptStruct(args)
	let logical_results = buildLogicalResults(args, prompt_struct, 0)
	/** @type {chatLogEntry_t} */
	let result = {
		content: '',
		files: [],
		extension: {},
	}
	regen: while (true) {
		console.log('logical_results', logical_results)
		console.log('prompt_struct')
		console.dir(prompt_struct, { depth: 4 })
		let AItype = logical_results.in_assist ? 'expert' : logical_results.in_nsfw ? 'nsfw' : 'sfw'
		result.content = await OrderedAISourceCalling(AItype, AI => AI.StructCall(prompt_struct))
		for (let repalyHandler of [coderunner, filesender])
			if (await repalyHandler(result, prompt_struct))
				continue regen
		break
	}
	return result
}
