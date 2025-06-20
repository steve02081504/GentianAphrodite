/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

import { OrderedAISourceCalling } from '../../AISource/index.mjs'
import { mergePrompt } from '../../prompt/build.mjs'
import { WebBrowsePrompt } from '../../prompt/functions/webbrowse.mjs'
import { CodeRunnerPrompt } from '../../prompt/functions/coderunner.mjs'
import { DeepResearchMainPrompt } from '../../prompt/functions/deep-research.mjs'
import { webbrowse } from './webbrowse.mjs'
import { googlesearch } from './googlesearch.mjs'
import { coderunner } from './coderunner.mjs'
import { GoogleSearchPrompt } from '../../prompt/functions/googlesearch.mjs'
import { getLongTimeLogAdder } from '../index.mjs'
import { config } from '../../config.mjs'
import { sleep } from '../../scripts/tools.mjs'
import { statisticDatas } from '../../scripts/statistics.mjs'

/**
 * Parses plan text into a structured plan array with relaxed validation.
 * Extracts all lines matching the "Step <number>:" pattern, regardless of order, continuity, or position.
 * Ignores lines that do not match the pattern.
 *
 * @param {string} text The text possibly containing plan steps.
 * @returns {{step: number, topic: string, result: string | null}[]} An array of parsed step objects, or an empty array if no matching lines are found or input is invalid. The order follows the appearance in the text.
 */
function parsePlan(text) {
	const plan = []
	if (!text || typeof text !== 'string') {
		console.warn('parsePlan: Input text is invalid or empty.')
		return []
	}

	// Regex to find lines starting with "Step <number>:" (case-insensitive, ignoring leading/trailing whitespace)
	const regex = /^\s*step\s+\d+\s*[:：]\s*(.*?)\s*$/gim

	let match
	let index = 0
	while ((match = regex.exec(text)) !== null) {
		const stepNum = ++index // Assign step numbers sequentially based on order found
		const topic = match[1].trim()

		plan.push({
			step: stepNum,
			topic,
			result: null,
		})
	}

	if (plan.length === 0)
		console.warn('parsePlan: No lines matching the \'Step <number>:\' pattern were found in the text.')

	return plan
}


/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export async function deepResearch(result, args) {
	const { max_planning_cycles, thinking_interval, initial_plan_max_retries, summary_max_retries } = config.deep_research
	const { AddLongTimeLog, prompt_struct } = args

	result.extension.execed_codes ??= {}

	const questionMatch = result.content.match(/<deep-research>(?<question>[\S\s]*?)<\/deep-research>/)
	if (!questionMatch?.groups?.question) return false
	const question = questionMatch.groups.question.trim()
	if (!question) {
		console.warn('DeepResearch: Extracted question is empty.')
		return false
	}

	console.info('DeepResearch Start:' + question)

	/** @type {prompt_struct_t} */
	const thinking_prompt_struct = {
		...prompt_struct,
		char_prompt: null, // Will be set dynamically based on the phase (planning vs execution)
		other_chars_prompt: {},
		world_prompt: { // Minimal world prompt sufficient for the thinking context
			text: [],
			additional_chat_log: [],
			extension: {}
		},
		plugin_prompts: {},
		chat_log: [],
	}

	let plan = []
	let planningCycles = 0
	const addThinkingLongTimeLog = getLongTimeLogAdder(null, thinking_prompt_struct) // Log adder specific to this thinking process
	const startTime = Date.now()
	const thinkingArgs = {
		UserCharname: args.UserCharname,
		username: args.username,
		chat_log: thinking_prompt_struct.chat_log,
		AddLongTimeLog: addThinkingLongTimeLog,
		prompt_struct: thinking_prompt_struct,
		chat_scoped_char_memory: args.chat_scoped_char_memory,
		plugins: args.plugins,
		supported_functions: {
			markdown: true,
			files: false,
			add_message: false,
			mathjax: true,
			html: true,
			unsafe_html: false
		}
	}
	const thinking_logical_results = {
		...args.extension.logical_results,
		in_assist: true,
	}

	AddLongTimeLog({
		content: `<deep-research>\n${question}\n</deep-research>\n`,
		name: '龙胆', // Assuming '龙胆' is the character triggering this
		role: 'char',
	})

	// --- Initial Plan Generation ---
	try {
		thinking_prompt_struct.char_prompt = await DeepResearchMainPrompt() // Base prompt for planning AI
		const initialPlanPrompt = `\
<chatLog>
${prompt_struct.chat_log.slice(-10).map(x => x.name + ': ' + x.content).join('\n')}
</chatLog>

为解决此问题制定计划：
<question>
${question}
</question>

**重要：你的回答必须严格按照以下格式，没有其他任何文字！**
\`\`\`
Plan:
Step 1: <步骤1主题>
Step 2: <步骤2主题>
...
\`\`\`

**规则：**
* 回答以 \`Plan:\` 开始。
* 步骤编号 **必须** 从 1 开始，连续递增。
* **禁止** 在步骤列表之前或之后添加任何解释、评论或无关文字。
* 如果格式错误，请求将被拒绝。

**请严格遵守以上格式。**
`

		thinking_prompt_struct.chat_log.push({
			content: initialPlanPrompt,
			name: 'system',
			role: 'system',
		})

		let retries = 0
		while (plan.length === 0 && retries < initial_plan_max_retries) {
			retries++
			console.info(`Deep-research: Requesting initial plan (Attempt ${retries}/${initial_plan_max_retries})...`)

			const requestResult = await OrderedAISourceCalling('deep-research', AI => AI.StructCall(thinking_prompt_struct))
			const planText = requestResult.content

			plan = parsePlan(planText) // Use the tolerant parser

			if (plan.length > 0) {
				console.info(`Deep-research: Initial Plan Generated (Attempt ${retries}):\n${plan.map(p => `Step ${p.step}: ${p.topic}`).join('\n')}`)
				thinking_prompt_struct.chat_log.push({
					content: 'Plan:\n' + plan.map(p => `Step ${p.step}: ${p.topic}`).join('\n') + '\n',
					name: '龙胆',
					role: 'char',
				})
			} else {
				console.warn(`Deep-research: Initial Plan Failed or Malformed (Attempt ${retries}/${initial_plan_max_retries}). Received:\n${planText}`)
				thinking_prompt_struct.chat_log.push({
					content: planText,
					name: '龙胆',
					role: 'char',
				})
				if (retries < initial_plan_max_retries) {
					thinking_prompt_struct.chat_log.push({
						content: `你上次的输出未能解析为有效的计划。请确保你的回答直接以 "Step 1: ..." 开始，或者以 "Plan:" 开头然后紧跟 "Step 1: ..."。步骤必须从1开始且连续。请严格按要求重新生成 (${retries}/${initial_plan_max_retries})。`,
						name: 'system',
						role: 'system',
					})
					await sleep(thinking_interval)
				}
			}
		}

		if (plan.length === 0) {
			console.error(`Deep-research: Failed to generate a valid initial plan after maximum retries (${initial_plan_max_retries}).`)
			AddLongTimeLog({
				content: `无法生成有效的初始计划，已达到最大重试次数 (${initial_plan_max_retries})。思考中止。`,
				name: 'system',
				role: 'system',
			})
			return true
		}
	} catch (error) {
		console.error('Deep-research: Error during initial plan generation:', error)
		AddLongTimeLog({
			content: `在生成初始计划时遇到错误: ${error.message}. 思考中止。`,
			name: 'system',
			role: 'system',
		})
		return true
	}


	// --- Planning and Execution Cycle ---
	try {
		replan: while (planningCycles < max_planning_cycles) {
			statisticDatas.toolUsage.deepResearchSessions++
			planningCycles++
			console.info(`Deep-research: Starting planning cycle ${planningCycles}/${max_planning_cycles}`)

			thinking_prompt_struct.char_prompt = mergePrompt(
				await Promise.all(
					[DeepResearchMainPrompt, GoogleSearchPrompt, WebBrowsePrompt, CodeRunnerPrompt]
						.map(p => p(thinkingArgs, thinking_logical_results, thinking_prompt_struct, 0))
				),
			)

			for (const step of plan) {
				// Skip steps that were completed in previous cycles (relevant after replanning)
				if (step.result !== null) {
					console.info(`Deep-research: Cycle ${planningCycles}, Skipping Step ${step.step} as it already has a result.`)
					continue
				}

				const stepExecutionPrompt = `\
**当前计划步骤：**
**Step ${step.step}: ${step.topic}**

**任务：**
1. **执行** 此步骤。
2. **输出结果：**
	* **若需工具：** 输出工具调用指令（例如 \`<run-js>code</run-js>\` 或 \`<google-search>查询内容</google-search>\`）。工具执行后，其结果将添加到对话记录中，你需基于新信息继续处理**本步骤**，直到你能输出本步骤的最终文本结果或明确的障碍说明。
	* **若无需工具或工具已执行完毕：** 输出**本步骤最终的文本结果**。
	* **若当前无法执行（例如信息不足且无法通过工具获取）：** 明确说明遇到的障碍。

**规则：**
* **仅** 输出以下之一：工具调用指令、最终文本结果、障碍说明。
* **禁止** 输出任何解释、对话、计划列表或步骤编号标签（如 "Step X:"）。
`
				thinking_prompt_struct.chat_log.push({
					content: stepExecutionPrompt,
					name: 'system',
					role: 'system',
				})

				let stepCompleted = false
				regen_step: while (!stepCompleted) {
					console.info(`Deep-research: Cycle ${planningCycles}, Requesting execution for Step ${step.step}: ${step.topic}`)
					const requestResult = await OrderedAISourceCalling('deep-research', AI => AI.StructCall(thinking_prompt_struct))
					const stepOutput = {
						content: requestResult.content,
						name: '龙胆',
						role: 'char',
						files: requestResult.files, // Include files if any were attached to the response
						extension: {}
					}

					let functionCalled = false
					for (const replyHandler of [coderunner, googlesearch, webbrowse])
						if (await replyHandler(stepOutput, thinkingArgs)) {
							functionCalled = true
							console.info(`Deep-research: Cycle ${planningCycles}, Step ${step.step} - Function triggered by handler: ${replyHandler.name}. Waiting for result...`)
							// The replyHandler is expected to add the function call result to thinkingContext.chat_log
							await sleep(thinking_interval)
							// Continue the inner loop to let the AI process the function result for the same step
							continue regen_step
						}


					if (!functionCalled) {
						// Check if AI mistakenly generated a plan or step instead of executing the current one
						if (stepOutput.content.trim().toLowerCase().startsWith('plan:') || /^\s*Step\s*\d+\s*[:：]/.test(stepOutput.content)) {
							console.warn(`Deep-research: Cycle ${planningCycles}, Step ${step.step} - AI generated plan/step instead of executing. Output:\n${stepOutput.content}\nRegenerating...`)
							thinking_prompt_struct.chat_log.push(stepOutput) // Log the incorrect output
							thinking_prompt_struct.chat_log.push({
								content: '你错误地生成了计划或步骤编号，而不是执行当前步骤。请专注于执行当前步骤 (Step ' + step.step + ') 并输出其最终文本结果、工具调用或障碍说明。',
								name: 'system',
								role: 'system',
							})
							await sleep(thinking_interval)
							continue regen_step // Retry the step execution
						}

						// Assume valid execution output (text result or obstacle description)
						console.info(`Deep-research: Cycle ${planningCycles}, Step ${step.step} Result: ${stepOutput.content}`)
						step.result = stepOutput.content // Store the final text result for this step
						thinking_prompt_struct.chat_log.push(stepOutput) // Log the final step output
						stepCompleted = true
						await sleep(thinking_interval) // Small delay before next step or summary phase
						break regen_step
					}
				}
			}

			// --- Summary and Re-planning Phase ---
			const isFinalCycle = planningCycles >= max_planning_cycles
			thinking_prompt_struct.char_prompt = await DeepResearchMainPrompt() // Reset to base prompt for summary/replan decision

			// Dynamically adjust the prompt based on whether replanning is allowed
			const summaryPrompt = `\
**当前进展总结：**
${plan.map(s => `Step ${s.step}: ${s.topic}\nResult: ${s.result ?? '*尚未完成*'}`).join('\n')}

**评估与决策：**
${isFinalCycle ? '**已达最大规划次数。必须提供最终答案或声明失败。**' : ''}
回顾所有已执行步骤及其结果。现在必须选择以下一项，并严格以指定标记开头，然后按要求提供内容：

1. **\`deep-research-answer:\`**
  * 后接：**最终答案**。根据已完成的步骤，简洁地总结最终的解决方案或发现。

2. **\`deep-research-failed:\`**
  * 后接：**失败原因**。说明为什么无法完成任务，遇到的主要障碍是什么，以及关键的尝试步骤。
${!isFinalCycle ? `
3. **\`deep-research-replan:\`** (当前 ${planningCycles}/${max_planning_cycles} 次循环)
  * 后接：**需要重新规划的原因** 和 **新的计划**。简要分析当前进展、遇到的问题，并提出一个全新的、完整的步骤计划。
  * **新计划必须** 严格按以下格式之一提供：
	\`\`\`
	Plan:
	Step 1: <新主题1>
	Step 2: <新主题2>
	...
	\`\`\`
` : ''}
**<<< 你的回答必须严格以上述标记之一开头，禁止任何额外的前缀文字 >>>**
`

			thinking_prompt_struct.chat_log.push({
				content: summaryPrompt,
				name: 'system',
				role: 'system',
			})

			let summaryRetries = 0
			let summaryRaw = '' // Define summaryRaw outside the loop to be accessible in the final fallback log
			summary_regen: while (true) {
				console.info(`Deep-research: Cycle ${planningCycles}, Requesting summary/replan (Attempt ${summaryRetries}/${summary_max_retries})...`)
				const requestResult = await OrderedAISourceCalling('deep-research', AI => AI.StructCall(thinking_prompt_struct))
				summaryRaw = requestResult.content // Assign here
				const summary = summaryRaw.trim() // Use trimmed version for marker checks

				// Log AI attempt immediately
				thinking_prompt_struct.chat_log.push({
					content: summaryRaw,
					name: '龙胆',
					role: 'char',
				})

				if (summary.startsWith('deep-research-answer:')) {
					const endTime = Date.now()
					const thinkingTime = (endTime - startTime) / 1000
					const answer = summary.substring('deep-research-answer:'.length).trim()
					console.info(`Deep-research: Finished (Answer) after ${planningCycles} cycles. Time: ${thinkingTime.toFixed(2)}s. Answer:\n${answer}`)
					AddLongTimeLog({
						content: `深入研究完成 (耗时 ${thinkingTime.toFixed(2)} 秒, ${planningCycles} 轮)。\n<deep-research-answer>\n${answer}\n</deep-research-answer>\n(请用自然语气复述以上结果)`,
						name: 'deep-research',
						role: 'tool',
					})
					return true // Finished successfully
				} else if (summary.startsWith('deep-research-failed:')) {
					const endTime = Date.now()
					const thinkingTime = (endTime - startTime) / 1000
					const reason = summary.substring('deep-research-failed:'.length).trim()
					console.info(`Deep-research: Finished (Failed) after ${planningCycles} cycles. Time: ${thinkingTime.toFixed(2)}s. Reason:\n${reason}`)
					AddLongTimeLog({
						content: `深入研究未能成功 (耗时 ${thinkingTime.toFixed(2)} 秒, ${planningCycles} 轮)。\n<deep-research-failed>\n${reason}\n</deep-research-failed>\n(请用自然语气说明失败原因)`,
						name: 'deep-research',
						role: 'tool',
					})
					return true // Finished with failure
				} else if (!isFinalCycle && summary.startsWith('deep-research-replan:')) {
					const replanContent = summary.substring('deep-research-replan:'.length).trim()
					const newPlan = parsePlan(replanContent) // Attempt to parse new plan using the tolerant parser

					await sleep(thinking_interval) // Small delay before potentially starting next cycle

					if (newPlan.length > 0) {
						console.info(`Deep-research: Cycle ${planningCycles}, Replanning successful. New Plan:\n${newPlan.map(p => `Step ${p.step}: ${p.topic}`).join('\n')}`)
						plan = newPlan // Adopt the new plan (results are reset by parsePlan)
						continue replan // Start the next planning cycle with the new plan
					} else {
						console.warn(`Deep-research: Replan requested, but plan format invalid or missing in response (Attempt ${summaryRetries}/${summary_max_retries}). Content:\n${replanContent}`)
						// Add specific retry message explaining the required replan format
						thinking_prompt_struct.chat_log.push({
							content: `你选择了重新规划 (deep-research-replan:)，但提供的后续内容未能解析为有效的新计划。请确保在 \`deep-research-replan:\` 标记后，先给出简要原因，然后提供格式正确的新计划（以 "Step 1: ..." 或 "Plan:\nStep 1: ..." 开始）。请重试 (${summaryRetries}/${summary_max_retries})。`,
							name: 'system',
							role: 'system',
						})
						await sleep(thinking_interval)
						summaryRetries++ // Increment retries before continuing
						continue summary_regen // Retry the summary/replan generation
					}
				}
				// Increment summaryRetries only if we are about to retry or fail due to retries
				summaryRetries++
				if (summaryRetries >= summary_max_retries) {
					console.error(`Deep-research: Failed to generate valid summary/replan after ${summary_max_retries} retries in cycle ${planningCycles}.`)
					AddLongTimeLog({
						content: `\
总结/重新规划阶段失败，已达最大重试次数 (${summary_max_retries})。思考中止。
最后一次的总结:
${summaryRaw}
`,
						name: 'deep-research',
						role: 'tool',
					})
					return true
				}
				else {
					// Handle cases: invalid marker, or 'deep-research-replan:' used on the final cycle
					const reason = isFinalCycle && summary.startsWith('deep-research-replan:')
						? '不允许在最终循环中重新规划。'
						: `回答必须以 ${isFinalCycle ? '`deep-research-answer:` 或 `deep-research-failed:`' : '`deep-research-answer:`, `deep-research-failed:`, 或 `deep-research-replan:`'} 中的一个标记开头。`
					console.warn(`Deep-research: Summary/Replan response invalid (Attempt ${summaryRetries}/${summary_max_retries}). Reason: ${reason} Received:\n${summaryRaw}`)
					thinking_prompt_struct.chat_log.push({
						content: `${reason} 你上次的输出未能正确处理。请根据当前情况选择一个有效标记并重新生成回答 (${summaryRetries}/${summary_max_retries})。`,
						name: 'system',
						role: 'system',
					})
					await sleep(thinking_interval)
					// Retries already incremented above
					continue summary_regen // Retry the summary/replan generation
				}
			} // End summary_regen loop
		} // End replan loop

		// Fallback: This point should ideally not be reached if the logic within the loops correctly forces an exit via answer/failed/error.
		// It acts as a safeguard in case max_planning_cycles is hit without a proper conclusion in the final summary phase.
		console.error(`Deep-research: Reached end of planning cycles (${max_planning_cycles}) without explicit finish (answer/failed). This indicates a potential logic flaw or unexpected AI behavior.`)
		AddLongTimeLog({
			content: `\
深入研究在达到最大循环次数 (${max_planning_cycles}) 后意外结束，未能明确得出答案或失败结论。
最后一次的总结:
${summaryRaw}
`,
			name: 'deep-research',
			role: 'tool',
		})
		return true
	} catch (error) {
		console.error('Deep-research: Error during planning/execution cycle:', error)
		const endTime = Date.now()
		const thinkingTime = (endTime - startTime) / 1000
		AddLongTimeLog({
			content: `在思考执行过程中遇到错误 (耗时 ${thinkingTime.toFixed(2)} 秒, ${planningCycles} 轮): ${error.message}. 思考中止。`,
			name: 'deep-research',
			role: 'tool',
		})
		return true
	}
}
