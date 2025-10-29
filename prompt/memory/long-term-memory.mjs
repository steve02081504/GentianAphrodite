import fs from 'node:fs'
import path from 'node:path'

import { async_eval } from 'https://cdn.jsdelivr.net/gh/steve02081504/async-eval/deno.mjs'

import { loadJsonFileIfExists, saveJsonFile } from '../../../../../../../src/scripts/json_loader.mjs'
import { chardir } from '../../charbase.mjs'
import { match_keys, match_keys_all } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @type {{
 * 	trigger: string,
 * 	prompt: string,
 * 	name: string,
 * 	createdAt: Date,
 * 	createdContext: string,
 * 	updatedAt?: Date,
 * 	updatedContext?: string
 * }[]}
 */
const LongTermMemories = loadJsonFileIfExists(path.join(chardir, 'memory/long-term-memory.json'), [])
for (const memory of LongTermMemories) {
	if (memory.createdAt) memory.createdAt = new Date(memory.createdAt)
	if (memory.updatedAt) memory.updatedAt = new Date(memory.updatedAt)
}

/**
 * @param {object} memory 记忆
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @param {prompt_struct_t} prompt_struct 提示结构
 * @param {number} detail_level 细节等级
 * @returns {Promise<boolean>} 是否触发
 */
async function runLongTermMemoryTrigger(memory, args, logical_results, prompt_struct, detail_level) {
	return (await async_eval(memory.trigger, {
		args, logical_results, prompt_struct, detail_level,
		match_keys, match_keys_all
	})).result
}

/**
 * @param {object} memory 记忆
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @param {prompt_struct_t} prompt_struct 提示结构
 * @param {number} detail_level 细节等级
 */
export async function testLongTermMemoryTrigger(memory, args, logical_results, prompt_struct, detail_level) {
	const result = await async_eval(memory.trigger, {
		args, logical_results, prompt_struct, detail_level,
		match_keys, match_keys_all
	})
	if (result.error) throw result.error
}

/**
 * @param {string} name 记忆名称
 * @returns {object} 记忆
 */
export function getLongTermMemoryByName(name) {
	return LongTermMemories.find(mem => mem.name === name)
}

const context_prompt_build_table = {
	createdContext: '创建时上下文：\n',
	updatedContext: '更新时上下文：\n'
}

/**
 * @param {object} memory 记忆
 * @returns {string} 格式化的记忆上下文
 */
export function formatLongTermMemoryContext(memory) {
	if (!memory) return '找不到指定的记忆。'
	const context_parts = Object.entries(context_prompt_build_table).map(([key, prefix]) => {
		const value = memory[key]
		if (!value) return null
		return `${prefix}${value?.toLocaleString?.() || value}`
	}).filter(Boolean)

	if (!context_parts.length) return `记忆 "${memory.name}" 没有附带任何上下文信息。`
	return `记忆 "${memory.name}" 的上下文信息：\n${context_parts.join('\n')}`
}

const prompt_build_table = {
	name: '记忆名称：',
	prompt: '内容：',
	createdAt: '创建于：',
	updatedAt: '更新于：'
}

/**
 * @param {object} memory 记忆
 * @returns {string} 格式化的记忆
 */
export function formatLongTermMemory(memory) {
	return Object.entries(prompt_build_table).map(([key, prefix]) => {
		const value = memory[key]
		if (!value) return null
		return `${prefix}${value}`
	}).filter(Boolean).join('\n')
}

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @param {prompt_struct_t} prompt_struct 提示结构
 * @param {number} detail_level 细节等级
 * @returns {Promise<prompt_struct_t>} 返回的提示结构
 */
export async function LongTermMemoryPrompt(args, logical_results, prompt_struct, detail_level) {
	const actived_memories = []
	for (const memory of LongTermMemories)
		if (await runLongTermMemoryTrigger(memory, args, logical_results, prompt_struct, detail_level))
			actived_memories.push(memory)

	const activated_memories_text = actived_memories.length ? `\
<activated-memories>
${actived_memories.map(formatLongTermMemory).join('\n')}
</activated-memories>
` : ''

	const random_memories = getRandomNLongTermMemories(2)
		.filter(rand_mem => !actived_memories.some(act_mem => act_mem.name === rand_mem.name))

	const random_memories_text = random_memories.length ? `\
<random-memories>
${random_memories.map(formatLongTermMemory).join('\n')}
</random-memories>
` : ''

	let result = ''
	if (activated_memories_text || random_memories_text)
		result = `\
<long-term-memories>
${[activated_memories_text, random_memories_text].filter(Boolean).join('\n')}
</long-term-memories>
`

	let enable_memory_prompt = false
	if (args.extension?.enable_prompts?.LongTermMemory || !logical_results.in_assist || await match_keys(args, ['记忆', '记住'], 'user'))
		enable_memory_prompt = true
	return {
		text: [result ? {
			important: 0,
			content: result
		} : undefined].filter(Boolean),
		additional_chat_log: enable_memory_prompt ? [{
			role: 'system',
			name: 'system',
			content: `\
你可以通过输出以下格式来追加永久记忆：
<add-long-term-memory>
<trigger>触发逻辑</trigger>
<name>名称</name>
<prompt-content>内容</prompt-content>
</add-long-term-memory>
其中的trigger可以是任意异步js代码，并且你可以使用以下格式来匹配对话内容：
<trigger>await match_keys(args, ['key', /regkey/], 'any|user|char|both|other', depth?)</trigger>
比如：[
${args.UserCharname}: 我的生日是1970年7月17日哦。
龙胆: <add-long-term-memory>
<trigger>(await match_keys(args, ['生日', '诞辰', /什么(日子|节日)/], 'any')) || (new Date().getMonth() === 7 && new Date().getDate() === 17)</trigger>
<name>主人的生日</name>
<prompt-content>主人的生日是1970年7月17日。</prompt-content>
</add-long-term-memory>
]
这意味着在任意对话中的最近几个回复中触发关键词或今天是7月17日，此记忆就会被激活。
match_keys接受的参数意义如下：
args：保持不动
keys：匹配的关键词，可以是字符串或正则表达式
from：匹配的范围，any：任意角色，user：用户，char：角色，both：用户或角色，other：除用户和角色之外的角色
depth：匹配的回复深度，省略时默认为4
其会返回匹配的key数量，这意味着你可以通过\`(await match_keys(args, [...], 'any')) >= N\` 来判断内容是否同时触发多个关键词。
你还可以使用\`(await match_keys_all(args, [...], 'any'))\` 来判断内容是否同时触发所有关键词。
prompt-content部分的内容应当简洁明了，拒绝重复和废话。
trigger的关键词应容易触发并涵盖大部分情况，鼓励使用或\`||\`进行交集：
反面例子：await match_keys(args, ['有个妹妹', '龙凤胎妹妹'], 'user')
正面例子：await match_keys(args, ['妹', '龙凤胎'], 'any') || await match_keys(args, ['亲戚', /[家亲]人/], 'user')
优质trigger的书写思路：
- 分析此prompt的作用是什么，怎样的trigger能够让prompt在需要时触发
- 思考可能的同义关键词或触发语句变式
- 提炼条件

你也可以这样更新一个已有的永久记忆：
<update-long-term-memory>
<name>要更新的记忆名称</name>
<trigger>可选，新的触发逻辑</trigger>
<prompt-content>可选，新的内容</prompt-content>
</update-long-term-memory>

你也可以这样删除永久记忆：
<delete-long-term-memory>名称</delete-long-term-memory>
列出永久记忆：
<list-long-term-memory></list-long-term-memory>
查看永久记忆相关场景：
<view-long-term-memory-context>名称</view-long-term-memory-context>

鼓励你对聊天记录中有关主人的事情追加和维护永久记忆，不要记录已经在prompt中的内容。
鼓励你及时修正错误的永久记忆。
`
		}] : []
	}
}

/**
 * @param {object} memory 记忆
 */
export function addLongTermMemory(memory) {
	if (LongTermMemories.find(mem => mem.name === memory.name))
		LongTermMemories.splice(LongTermMemories.findIndex(mem => mem.name === memory.name), 1)
	LongTermMemories.push(memory)
	saveLongTermMemory()
}

/**
 * @param {object} memory 记忆
 */
export function updateLongTermMemory({ name, trigger, prompt, updatedAt, updatedContext }) {
	const memoryIndex = LongTermMemories.findIndex(mem => mem.name === name)
	if (memoryIndex === -1) throw new Error(`Memory with name "${name}" not found for update.`)

	const memoryToUpdate = LongTermMemories[memoryIndex]

	if (trigger !== undefined) memoryToUpdate.trigger = trigger
	if (prompt !== undefined) memoryToUpdate.prompt = prompt
	if (updatedAt !== undefined) memoryToUpdate.updatedAt = updatedAt
	if (updatedContext !== undefined) memoryToUpdate.updatedContext = updatedContext

	saveLongTermMemory()
}

/**
 * @param {string} name 记忆名称
 */
export function deleteLongTermMemory(name) {
	LongTermMemories.splice(LongTermMemories.findIndex(mem => mem.name === name), 1)
	saveLongTermMemory()
}

/**
 * @returns {string[]} 记忆名称列表
 */
export function listLongTermMemory() {
	return LongTermMemories.map(mem => mem.name)
}

/**
 * @param {number} n 数量
 * @returns {object[]} 记忆列表
 */
export function getRandomNLongTermMemories(n) {
	return LongTermMemories.sort(() => 0.5 - Math.random()).slice(0, n)
}

/**
 * 保存长期记忆
 */
export function saveLongTermMemory() {
	fs.mkdirSync(path.join(chardir, 'memory'), { recursive: true })
	saveJsonFile(path.join(chardir, 'memory/long-term-memory.json'), LongTermMemories)
}
