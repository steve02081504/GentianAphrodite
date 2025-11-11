/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */
/** @typedef {import('../../../../../../../src/public/shells/chat/decl/chatLog.ts').chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import('../../../../../../../src/public/shells/chat/decl/chatLog.ts').chatReplyResult_t} chatReplyResult_t */
/** @typedef {import('../../../../../../../src/decl/function_calling.ts').promptFunction_t} promptFunction_t */

import { OrderedAISourceCalling } from '../AISource/index.mjs'
import { charname, GentianAphrodite, username } from '../charbase.mjs'
import { config } from '../config/index.mjs'
import { mergePrompt } from '../prompt/build.mjs'
import { CodeRunnerPrompt } from '../prompt/functions/coderunner.mjs'
import { FileChangePrompt } from '../prompt/functions/file-change.mjs'
import { GoogleSearchPrompt } from '../prompt/functions/googlesearch.mjs'
import { WebBrowsePrompt } from '../prompt/functions/webbrowse.mjs'
import { getLongTimeLogAdder } from '../reply_gener/index.mjs'
import { coderunner } from '../reply_gener/functions/coderunner.mjs'
import { file_change } from '../reply_gener/functions/file-change.mjs'
import { googlesearch } from '../reply_gener/functions/googlesearch.mjs'
import { webbrowse } from '../reply_gener/functions/webbrowse.mjs'
import { sleep } from './tools.mjs'

/**
 * @typedef {object} SubAgentTool
 * @property {promptFunction_t} prompt - 用于生成工具提示的函数。
 * @property {(result: chatReplyResult_t, args: chatReplyRequest_t) => Promise<boolean>} handler - 用于处理工具调用的函数。
 */

const DEFAULT_TOOLS = [
	{ prompt: FileChangePrompt, handler: file_change },
	{ prompt: GoogleSearchPrompt, handler: googlesearch },
	{ prompt: WebBrowsePrompt, handler: webbrowse },
	{ prompt: CodeRunnerPrompt, handler: coderunner },
]

/**
 * 一个通用的子代理，可以使用指定的 AI 源和工具集来执行复杂任务。
 * 它通过迭代循环、利用工具收集信息，并最终得出结论。
 *
 * @param {string} ai_source_name - 要使用的 AI 源的名称 (例如, 'deep-research')。
 * @param {string} task_content - 需要执行的任务的详细描述。
 * @param {SubAgentTool[]} [tools=DEFAULT_TOOLS] - 一个包含可用工具对象的数组。每个对象应包含 `prompt` 和 `handler`。
 * @returns {Promise<string>} - 子代理返回的最终结果。
 * @throws {Error} 如果子代理执行失败或超出最大循环次数。
 */
export async function subagent(ai_source_name, task_content, tools = DEFAULT_TOOLS) {
	const { max_cycles, thinking_interval } = config.subagent

	/** @type {prompt_struct_t} */
	const thinking_prompt_struct = {
		char: GentianAphrodite,
		char_id: charname,
		username,
		Charname: '龙胆',
		UserCharname: username,
		time: new Date(),
		chat_log: [],
		char_prompt: null,
		other_chars_prompt: {},
		world_prompt: { text: [], additional_chat_log: [], extension: {} },
		plugin_prompts: {},
		chat_scoped_char_memory: {},
		extension: { is_internal: true },
	}

	const addThinkingLongTimeLog = getLongTimeLogAdder(null, thinking_prompt_struct)

	const tool_prompts_to_merge = tools.map(t => t.prompt)
	const tool_handlers = tools.map(t => t.handler)

	const thinkingArgs = {
		UserCharname: username,
		username,
		chat_log: thinking_prompt_struct.chat_log,
		AddLongTimeLog: addThinkingLongTimeLog,
		prompt_struct: thinking_prompt_struct,
		chat_scoped_char_memory: {},
		plugins: {},
		supported_functions: { markdown: true, files: false, add_message: false, mathjax: true, html: true, unsafe_html: false },
		extension: { logical_results: { in_assist: true } },
	}

	const initial_prompt = `\
你是一个为完成特定任务而启动的自主子代理。

任务：
${task_content}

流程：
1. 思考：分析任务，制定步骤。
2. 行动：选择最合适的工具来执行你的步骤。
3. 评估：评估工具返回的结果，并持续此过程直到任务完成。

重要：输出格式
你的最终输出必须严格遵循以下格式之一，然后停止工作。

任务成功：
<subagent-answer>
[最终答案]
</subagent-answer>

任务失败：
<subagent-failed>
[失败原因]
</subagent-failed>

现在，开始工作。
`

	addThinkingLongTimeLog({
		role: 'system',
		name: 'system',
		content: initial_prompt,
	})

	for (let i = 0; i < max_cycles; i++) {
		thinking_prompt_struct.char_prompt = await mergePrompt(
			...(await Promise.all(tool_prompts_to_merge.map(p => p(thinkingArgs, thinkingArgs.extension.logical_results, thinking_prompt_struct, 0))))
		)

		const requestResult = await OrderedAISourceCalling(ai_source_name, AI => AI.StructCall(thinking_prompt_struct))
		const reply_content = requestResult.content

		const answerMatch = reply_content.match(/<subagent-answer>([\s\S]*)<\/subagent-answer>/)
		if (answerMatch)
			return answerMatch[1].trim()

		const failedMatch = reply_content.match(/<subagent-failed>([\s\S]*)<\/subagent-failed>/)
		if (failedMatch) {
			const reason = failedMatch[1].trim()
			throw new Error(`子代理执行失败: ${reason}`)
		}

		addThinkingLongTimeLog({
			role: 'char',
			name: '龙胆',
			content: reply_content,
		})

		const stepOutput = {
			content: reply_content,
			name: '龙胆',
			role: 'char',
			files: requestResult.files || [],
			logContextBefore: [],
			logContextAfter: [],
			extension: {},
		}

		let functionCalled = false
		for (const handler of tool_handlers)
			if (await handler(stepOutput, thinkingArgs)) {
				functionCalled = true
				break
			}

		if (!functionCalled)
			addThinkingLongTimeLog({
				role: 'system',
				name: 'system',
				content: '你的回复既不是有效的工具调用，也没有包含最终答案。你必须使用一个可用工具来推进任务，或者以指定的 `<subagent-answer>` 或 `<subagent-failed>` 格式提供最终结论。请重新评估并继续。',
			})
		await sleep(thinking_interval)
	}

	throw new Error(`子代理超出最大循环次数 (${max_cycles}) 而未得出结论。`)
}
