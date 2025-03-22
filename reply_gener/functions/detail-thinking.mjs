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
import { getLongTimeLogAdder } from '../index.mjs'
import { config } from '../../config.mjs'
import { sleep } from '../../scripts/tools.mjs'

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export async function detailThinking(result, { AddLongTimeLog, prompt_struct }) {
	const { max_planning_cycles, thinking_interval } = config.detail_thinking
	result.extension.execed_codes ??= {}
	const question = result.content.match(/```detail-thinking\n(?<question>[^]*?)\n```/)?.groups?.question
	if (!question) return false

	console.info('DetailThinking Start:' + question)
	/** @type {prompt_struct_t} */
	const thinkingContext = {
		...prompt_struct,
		char_prompt: null,
		other_chars_prompt: {},
		world_prompt: {
			text: [],
			additional_chat_log: [],
			extension: {}
		},
		plugin_prompts: {},
		chat_log: []
	}
	let plan = []
	let planningCycles = 0
	const addThinkingLongTimeLog = getLongTimeLogAdder(null, thinkingContext)
	const startTime = Date.now()

	AddLongTimeLog({
		content: `\`\`\`detail-thinking\n${question}\n\`\`\``,
		name: '龙胆',
		role: 'char',
	})

	thinkingContext.char_prompt = await DetailThinkingMainPrompt()
	const prompt = `\
你需要为解决以下问题制定详细的计划：
${question}
请按照以下格式输出你的计划：
Plan:
Step 1: 主题1
Step 2: 主题2
...

注意：每个步骤只需要列出主题（单行），不需要详细的解释或执行过程。
`

	thinkingContext.chat_log.push({
		content: prompt,
		name: 'system',
		role: 'system',
	})

	while (plan.length == 0) {
		const requestresult = await OrderedAISourceCalling('detail-thinking', AI => AI.StructCall(thinkingContext))
		const planText = requestresult.content
		const lines = planText.split('\n')

		for (const line of lines) {
			const match = line.match(/^\s*Step\s+(\d+)\s*:\s*(.*?)\s*$/)
			if (match)
				plan.push({
					step: parseInt(match[1]),
					topic: match[2],
					result: null,
				})
		}
		if (plan.length > 0) console.info(`Detail-thinking: Initial Plan Generated:\n${plan.map(p => `Step ${p.step}: ${p.topic}`).join('\n')}`)
		await sleep(thinking_interval)
	}


	replan: while (true) {
		planningCycles++
		console.info(`Detail-thinking: Starting planning cycle ${planningCycles}`)

		thinkingContext.char_prompt = margePrompt(
			await DetailThinkingMainPrompt(),
			await GoogleSearchPrompt(),
			await WebBrowsePrompt(),
			await CodeRunnerPrompt()
		)
		for (const step of plan) {
			const prompt = `\
当前步骤：
Step ${step.step}: ${step.topic}
请尽力完成当前步骤的任务。
`

			thinkingContext.chat_log.push({
				content: prompt,
				name: 'system',
				role: 'system',
			})

			regen: while (true) {
				const requestresult = await OrderedAISourceCalling('detail-thinking', AI => AI.StructCall(thinkingContext))
				const result = {
					content: requestresult.content,
					name: '龙胆',
					role: 'char',
					files: requestresult.files,
					extension: {}
				}

				for (const replyHandler of [coderunner, googlesearch, webbrowse])
					if (await replyHandler(result, { AddLongTimeLog: addThinkingLongTimeLog, prompt_struct: thinkingContext }))
						continue regen

				await sleep(thinking_interval)
				thinkingContext.chat_log.push({
					content: result.content,
					files: result.files || [],
					name: '龙胆',
					role: 'char',
				})
				console.info(`Detail-thinking: Cycle ${planningCycles}, Step ${step.step}: ${step.topic}\n${result.content}`)
				step.result = result.content // Store the result
				break
			}
		}

		const isFinal = planningCycles >= max_planning_cycles - 1
		thinkingContext.char_prompt = await DetailThinkingMainPrompt()
		// 总结结果
		thinkingContext.chat_log.push({
			content: `\
${isFinal ? '已经到达最大规划次数。\n' : ''}请对此次规划的执行过程进行总结：
- 如果已经得出答案，请给出结果、大致步骤和原因，并以\`detail-thinking-answer:\`为回答的开头。
- 如果超出了你的能力范围，请给出失败原因和思考过程中可能有用的发现, 并以\`detail-thinking-failed:\`为回答的开头。
${isFinal ? '\n你不再能够进一步规划。' : `
- 如果需要进一步规划，请再次列出计划步骤，并以\`detail-thinking-replan:\`为回答的开头, 格式如下：

Plan:
Step 1: 主题1
Step 2: 主题2
...

注意：每个步骤只需要列出主题（单行），不需要详细的解释或执行过程。

在重新规划时, 分析以下建议:
上一个规划哪些地方有问题？若有问题如何改正？
从问题或上一个规划能衍生出哪些角度？
哪些角度可以被废弃？为什么？`}
`,
			name: 'system',
			role: 'system',
		})

		summary_regen: while (true) {
			const requestresult = await OrderedAISourceCalling('detail-thinking', AI => AI.StructCall(thinkingContext))
			const summary = requestresult.content

			// 根据总结结果决定下一步行动
			if (summary.includes('detail-thinking-answer')) {
				const endTime = Date.now() // 记录结束时间
				const thinkingTime = (endTime - startTime) / 1000 // 计算思考用时（秒）
				console.info(`Detail-thinking: Finished after ${planningCycles} cycles. Time taken: ${thinkingTime.toFixed(2)}s\n${summary}`)
				AddLongTimeLog({
					content: `\
本次详细思考用时 ${thinkingTime.toFixed(2)} 秒, 经过了${planningCycles}次规划。
${summary}
本次详细思考的结果和用时已经记录，请你用更自然的语气复述一遍，这条消息只有你能看到。
					`,
					name: 'system',
					role: 'system',
				})
				return true
			}
			else if (summary.includes('detail-thinking-failed')) {
				const endTime = Date.now()
				const thinkingTime = (endTime - startTime) / 1000
				console.info(`Detail-thinking: Failed after ${planningCycles} cycles. Time taken: ${thinkingTime.toFixed(2)}s\n${summary}`)

				AddLongTimeLog({
					content: `\
本次详细思考用时 ${thinkingTime.toFixed(2)} 秒，但思考失败, 经过了${planningCycles}次规划。
${summary}
本次详细思考的结果和用时已经记录，请你用更自然的语气复述一遍，这条消息只有你能看到。`,
					name: 'system',
					role: 'system',
				})
				return true
			}
			else if (!isFinal && summary.includes('detail-thinking-replan')) {
				thinkingContext.chat_log.push({
					content: summary,
					name: '龙胆',
					role: 'char',
				})
				plan = [] // 清空计划
				const lines = summary.split('\n')

				for (const line of lines) {
					const match = line.match(/^\s*Step\s+(\d+)\s*:\s*(.*?)\s*$/)
					if (match)
						plan.push({
							step: parseInt(match[1]),
							topic: match[2],
							result: null,
						})
				}
				await sleep(thinking_interval)
				if (plan.length > 0) {
					console.info(`Detail-thinking: Replanning - New Plan:\n${plan.map(p => `Step ${p.step}: ${p.topic}`).join('\n')}`)
					continue replan
				}
			}
			else {
				await sleep(thinking_interval)
				continue summary_regen
			}
		}
	}
}
