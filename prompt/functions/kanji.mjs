import { getScopedChatLog } from '../../scripts/match.mjs'

/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * @typedef {object} ApiError
 * @property {boolean} error - 标志是否发生错误。
 * @property {string} message - 错误信息。
 */

/**
 * @typedef {Array} ApiResponse - API成功返回的原始 `res` 数据。
 */

/**
 * zi.tools API 的基本 URL。
 */
const API_BASE_URL = 'https://zi.tools/api/lookup/lookup/'

/**
 * 封装 zi.tools API，用于将多个部件组合成汉字。
 * @param {string[]} components - 一个包含要组合的汉字或部件的数组。例如：['王', '王', '女']
 * @returns {Promise<ApiResponse|ApiError>} 返回一个Promise，解析为API的返回内容或一个错误对象。
 */
async function combineCharacterComponents(components) {
	// 将数组用空格连接，并对URL进行编码，以处理特殊字符。
	const query = encodeURIComponent(components.join(' '))
	const requestUrl = `${API_BASE_URL}${query}`

	try {
		const response = await fetch(requestUrl)
		const data = await response.json()
		return data.res
	} catch (error) {
		return {
			error: true,
			message: error.message
		}
	}
}

/**
 * 封装 zi.tools API，用于查询单个汉字的部件构成和相关信息。
 * @param {string} character - 需要查询的单个汉字。例如：'韻'
 * @returns {Promise<ApiResponse|ApiError>} 返回一个Promise，解析为API的返回内容或一个错误对象。
 */
async function lookupCharacterInfo(character) {
	const query = encodeURIComponent(character)
	const requestUrl = `${API_BASE_URL}${query}`

	try {
		const response = await fetch(requestUrl)
		const data = await response.json()
		return data.res // 直接返回核心的 "res" 数组
	} catch (error) {
		return {
			error: true,
			message: error.message
		}
	}
}

/**
 * 自动处理关于汉字组合与拆分问题的Prompt模块。
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @returns {Promise<prompt_struct_t>} 返回的提示结构
 */
export async function KanjiPrompt(args, logical_results) {
	let result = ''
	const log = getScopedChatLog(args, 'any').map(x => x.content).join('\n')

	// 1. 处理汉字组合问题
	const combinationRegex = /([\p{Unified_Ideograph}\s、，,]+)(?:能|可以)?(?:组合|组成|组合成|构成|加起来).*(?:什么|哪个)字/gu

	for (const match of log.matchAll(combinationRegex)) {
		// 提取捕获的字符串，并清理掉所有非汉字字符
		const rawComponents = match[1]
		const components = rawComponents.replace(/[^\p{Unified_Ideograph}]/gu, '').split('')

		// 过滤掉无效的输入并确保至少有两个部件
		if (components.length < 2)
			continue


		console.log(`识别到的部件: [${components.join(', ')}]`) // 调试信息

		const apiResult = await combineCharacterComponents(components)

		if (apiResult && !apiResult.error && apiResult[0]?.length > 0) {
			const foundChars = apiResult[0].map(item => item[0]).join('、')
			result += `由部件 [${components.join('、')}] 组合成的汉字可能是：${foundChars}\n`
		} else
			// 即使API没有找到结果，也可以给出一个提示
			result += `工具没有找到由 [${components.join('、')}] 组合成的标准汉字。\n`

	}

	// 2. 处理汉字拆分问题
	const decompositionRegex = /(\p{Unified_Ideograph})\s*(?:能|可以)?(?:拆成|拆分成|拆成|的部件是|的结构是|怎么写|由什么组成)/gu

	for (const match of log.matchAll(decompositionRegex)) {
		const charToLookup = match[1]
		const apiResult = await lookupCharacterInfo(charToLookup)

		if (apiResult && !apiResult.error && apiResult[3]?.length > 0) {
			const components = apiResult[3].map(item => item[0]).join('、')
			result += `汉字 "${charToLookup}" 的可能部件拆解为：${components}\n`
		}
	}

	return {
		text: result ? [{
			content: `以下是关于汉字结构的预处理信息，可能对你的回答有帮助：\n${result}`,
			important: 1
		}] : []
	}
}
