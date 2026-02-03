import { Buffer } from 'node:buffer'

import { chineseToNumber } from '../../scripts/chineseToNumber.mjs'
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
 * 动态将文字渲染为图片 Buffer
 * 参考 qrcode.mjs 中的 canvas 引入方式
 * @param {string} text - 要渲染的汉字
 * @returns {Promise<Buffer|null>} 渲染后的图片 Buffer，如果渲染失败则返回 null
 */
async function renderTextToBuffer(text) {
	try {
		const { createCanvas } = await import('https://deno.land/x/canvas/mod.ts')

		if (!createCanvas) return null

		const size = 300 // 图片尺寸
		const canvas = createCanvas(size, size)
		const ctx = canvas.getContext('2d')

		// 1. 绘制白色背景
		ctx.fillStyle = '#ffffff'
		ctx.fillRect(0, 0, size, size)

		// 2. 绘制文字
		ctx.fillStyle = '#000000'
		// 尝试使用通用无衬线字体，系统会自动回退到支持中文的字体
		ctx.font = `${size * 0.75}px sans-serif, "Microsoft YaHei", "SimHei", Arial`
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'

		// 稍微调整位置以居中
		ctx.fillText(text, size / 2, size / 2 + (size * 0.05))

		// 3. 导出为 Buffer
		return Buffer.from(await canvas.toBuffer('image/png'))
	} catch (error) {
		console.error('Failed to render text to buffer:', error)
		return null
	}
}

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
 * 解析带有数量词的字符串，将其展开为部件数组。
 * 例如： "三个火和2个木" -> ['火', '火', '火', '木', '木']
 *       "龙龙龙" -> ['龙', '龙', '龙']
 * @param {string} text - 包含数量词和汉字的输入字符串
 * @returns {string[]} 展开后的汉字部件数组
 */
function expandComponents(text) {
	const result = []

	// 正则匹配策略：
	// 1. 尝试捕获前面的数字部分 (Group 1)，包括中文数字、阿拉伯数字、点号
	// 2. 忽略量词 (个、只、枚等)
	// 3. 捕获目标汉字 (Group 2)
	//
	// 注意：为了防止 "一万" (10000) 这种数字里的汉字被当成部件，我们必须严格匹配。
	// 但通常语境下 "一万个X" 中 "一万" 是数量。
	// 这里使用非贪婪匹配结合 chineseToNumber 的能力。

	const pattern = /(?:([\d.一七万三两九二五亿伍八六十千叁四壹捌柒玖百肆贰陆零]+)\s*[\s个只枚]?)?\s*([\p{Unified_Ideograph}])/gu

	let match
	while ((match = pattern.exec(text)) !== null) {
		const numStr = match[1]
		const char = match[2]

		let count = 1
		if (numStr) try {
			// 使用提供的库将中文数字转为阿拉伯数字字符串
			const parsedNum = chineseToNumber(numStr)
			// 转换为整数 (防止 "半个" 等情况，向下取整或至少为1)
			count = Math.floor(parseFloat(parsedNum))
			if (count < 1) count = 1
		} catch (e) {
			count = 1
		}

		// 限制一下最大数量，防止恶意输入 "一亿个龙" 撑爆内存
		if (count > 20) count = 20

		for (let i = 0; i < count; i++) result.push(char)
	}

	return result
}


/**
 * 处理汉字相关请求的主函数，包括组合和拆分查询。
 * @param {chatReplyRequest_t} args - 聊天请求上下文参数
 * @param {logical_results_t} logical_results - 逻辑推理结果
 * @returns {Promise<object>} 返回处理结果对象，包含文本和附加日志
 */
export async function KanjiPrompt(args, logical_results) {
	let result = ''
	const additional_chat_log = []
	const log = getScopedChatLog(args, 'any').map(x => x.content).join('\n')

	// 1. 处理汉字组合问题
	// 允许：汉字、数字、换行、斜杠、逗号、以及常见的连接词（和、加、跟...）
	const combinationRegex = /(?:```([\S\s]+?)```|`([^`]+)`|([\p{Unified_Ideograph}\d\s,/|、与加和跟，]+?))\s*(?:能|可以)?(?:组合|组成|组合成|构成|加起来|是|等于).*(?:什么|哪个)汉?字/gu

	for (const match of log.matchAll(combinationRegex)) {
		const codeBlockContent = match[1]
		const inlineCodeContent = match[2]
		const plainTextContent = match[3]

		const rawComponents = codeBlockContent || inlineCodeContent || plainTextContent
		if (!rawComponents) continue

		let components = []

		if (codeBlockContent || inlineCodeContent)
			// 代码块内，直接应用带数量词的解析逻辑
			components = expandComponents(rawComponents)
		else {
			// 普通文本，应用分块策略以去除 "考考你" 等上下文
			// 增加分隔符：除了非汉字，也要把数字视为内容的一部分，所以分隔符不能包含数字
			// 这里我们主要依靠 "空格" 和 "标点" 来分块，但保留数字和汉字
			// 简单策略：按 非(汉字|数字|连接词) 分割
			const blocks = rawComponents.split(/[^\p{Unified_Ideograph}\d与加和跟]+/u).filter(Boolean)

			if (blocks.length > 1) {
				const lastBlock = blocks[blocks.length - 1]
				const lastBlockComponents = expandComponents(lastBlock)

				// 启发式：如果最后一个块解析出了多个部件 (如 "三个火"->3部件 或 "龙龙"->2部件)
				// 或者原本长度就 > 1，则采纳
				if (lastBlockComponents.length > 1)
					components = lastBlockComponents
				else components = expandComponents(rawComponents) // 否则尝试解析整个字符串（应对 "王 王 王" 这种被空格分开的情况）
			} else components = expandComponents(rawComponents)
		}

		if (components.length < 2) continue

		// 去重并排序稍微优化一下显示，但传给API需要保留重复项吗？
		// zi.tools API 需要保留重复项（例如 '木' '木' -> '林'）
		console.log(`识别到的部件: [${components.join(', ')}]`)

		const apiResult = await combineCharacterComponents(components)

		if (apiResult && !apiResult.error && apiResult[0]?.length > 0) {
			const foundChars = apiResult[0].map(item => item[0]).join('、')
			result += `由部件 [${components.join('、')}] 组合成的汉字可能是：${foundChars}\n`
		}
		else result += `工具没有找到由 [${components.join('、')}] 组合成的标准汉字。\n`
	}

	// 2. 处理汉字拆分问题
	const decompositionRegex = /(\p{Unified_Ideograph})[\s`]*(?:这|这个|该)?(?:字符|符号|汉字|字|符)?(?:能|可以|该|是)?(?:拆成|拆分成|的部件是|的结构是|怎么[书写拆]|由什么组成|什么结构)/gu

	for (const match of log.matchAll(decompositionRegex)) {
		const charToLookup = match[1]
		const apiResult = await lookupCharacterInfo(charToLookup)

		let apiInfoStr = ''
		if (apiResult && !apiResult.error && apiResult[3]?.length > 0) {
			const components = apiResult[3].map(item => item[0]).join('、')
			apiInfoStr = `汉字 "${charToLookup}" 的可能部件拆解为：${components}\n`
		}

		// 生成汉字图片并添加到 additional_chat_log
		const imageBuffer = await renderTextToBuffer(charToLookup)

		if (imageBuffer)
			additional_chat_log.push({
				name: 'system',
				role: 'system',
				content: `用户疑似正在询问汉字 "${charToLookup}" 的结构。
为了帮助你准确识别，系统生成了该汉字的图像（见附件）。
请结合图像的视觉形状和以下数据进行回答：
${apiInfoStr || `（未查询到该字的拆解数据，请直接参考图像）
`}`,
				files: [{
					buffer: imageBuffer,
					name: `kanji_${charToLookup}.png`,
					mime_type: 'image/png'
				}]
			})
		else
			result += apiInfoStr
	}

	return {
		text: result ? [{
			content: `以下是关于汉字结构的预处理信息，可能对你的回答有帮助：\n${result}`,
			important: 1
		}] : [],
		additional_chat_log
	}
}
