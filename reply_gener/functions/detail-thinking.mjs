/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

import { OrderedAISourceCalling } from '../../AISource/index.mjs'
import { margePrompt } from '../../prompt/build.mjs'
import { WebBrowsePrompt } from '../../prompt/functions/webbrowse.mjs'
import { CodeRunnerPrompt } from '../../prompt/functions/coderunner.mjs'
import { DetailThinkingMainPrompt } from '../../prompt/functions/detail-thinking.mjs'
import { webbrowse } from './webbrowse.mjs'
import { googlesearch } from './googlesearch.mjs'
import { coderunner } from './coderunner.mjs'
import { GoogleSearchPrompt } from '../../prompt/functions/googlesearch.mjs'
import { getLongTimeLogAdder } from "../index.mjs";

/**
 * @param {chatLogEntry_t} result
 * @param {(entry: chatLogEntry_t) => void} addLongTimeLog
 * @returns {Promise<boolean>}
 */
export async function detailThinking(result, { addLongTimeLog, prompt_struct }) {
	result.extension.execed_codes ??= {}
	let question = result.content.match(/```detail-thinking\n(?<question>[^]*)\n```/)?.groups?.question
	if (question) {
		let thinking = {
			...prompt_struct,
			char_prompt: margePrompt(
				await DetailThinkingMainPrompt(),
				await GoogleSearchPrompt(),
				await WebBrowsePrompt(),
				await CodeRunnerPrompt()
			),
			other_chars_prompt: {},
			world_prompt: {
				text: [],
				additional_chat_log: [],
				extension: {}
			},
			plugin_prompts: {},
			chat_log: []
		}
		thinking.char_prompt.additional_chat_log = [
			{
				content: `\
detail-thinking-question: ${question}
`,
				name: 'system',
				role: 'system'
			},
			{
				content: `\
你应当总是深入思考问题，并输出以下内容：
detail-thinking-review: 上一步思考哪些地方有问题？若有问题如何改正？
detail-thinking-divergent: 对问题或上一步思考能衍生出哪些角度？
detail-thinking-deeper: 对每个角度进行深入的探索。
detail-thinking-denial: 哪些角度可以被废弃？为什么？
只有在你得出答案后你才能输出detail-thinking-answer和detail-thinking-overview。
detail-thinking-answer: 答案是什么？
detail-thinking-overview: 对思考过程的总结和简明概要，舍弃被废弃的角度和被否定的信息。
`,
				name: 'system',
				role: 'system'
			}
		]
		thinking.chat_log = [
			{
				content: `\
detail-thinking-review: 我理解了输出格式，现在请给出需要思考的问题，我会在下一个回合给出对问题的看法。
detail-thinking-divergent: 我理解了输出格式，接下来我会多角度的思考被提出的问题，并将角度列举在这个段落。
detail-thinking-deeper: 我还没有正式思考，所以没有任何深入的探索。但我会在下一个回合将详细的探索输出在这个段落。
detail-thinking-denial: 我还没有正式思考，所以没有任何角度可以被废弃。但如果有的话，我会在下一个回合将被废弃的角度列举在这个段落。
`,
				name: '龙胆',
				role: 'char'
			}
		]
		const addThinkingLongTimeLog = getLongTimeLogAdder(null, thinking)
		let result, times = 0
		regen: while (true) {
			result = {
				content: await OrderedAISourceCalling('detail-thinking', AI => AI.StructCall(thinking)),
				name: '龙胆',
				role: 'char',
				extension: {}
			}
			for (let repalyHandler of [
				coderunner, googlesearch, webbrowse,
			])
				if (await repalyHandler(result, { addLongTimeLog: addThinkingLongTimeLog, prompt_struct: thinking }))
					continue regen
			times++
			if (result.content.match(/(^|\n)detail-thinking-answer(:|：)/))
				break
			thinking.chat_log.push(result)
			console.info(`\
detail-thinking: ${question}
times: ${times}
${result.content}
`)
			await new Promise(resolve => setTimeout(resolve, 3000)) // 等3秒，防止AI源被频繁调用，也给人时间看log
		}
		result = result.content.split('detail-thinking-').map(block => block.trim()).filter(block => block)
		addLongTimeLog({
			content: `\
\`\`\`detail-thinking
${question}
\`\`\`
`,
			name: '龙胆',
			role: 'char'
		})
		addLongTimeLog({
			content: `\
在详细思考模式下思考了${times}次
${result.find(block => block.match(/^answer/)) ?? ''}
${result.find(block => block.match(/^overview/)) ?? ''}
这条消息不会被他人看到，如有必要请带语气地解说和复述一遍。
`,
			name: 'system',
			role: 'system'
		})
		return true
	}

	return false
}
