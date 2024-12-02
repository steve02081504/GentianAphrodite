/** @typedef {import('../../../../../../src/decl/AIsource.ts').AIsource_t} AIsource_t */

import { getPartInfo } from '../../../../../../src/server/parts_loader.mjs'

/**
 * @type {Record<string, AIsource_t>}
 */
export let AIsources = {
	'detail-thinking': null,
	'web-browse': null,
	nsfw: null,
	sfw: null,
	expert: null,
	logic: null
}

export function SetAISource(source, type) {
	AIsources[type] = source
	console.info('Set AI source:', type, getPartInfo(source).name)
}

export function GetAISource(type) {
	return AIsources[type]
}

export function noAISourceAvailable() {
	let result = !Object.values(AIsources).some(x => x)
	if (result) console.log('No AI source available:', AIsources)
	return result
}

/**
 * @param {string} name
 * @returns {string[]}
 */
export function GetAISourceCallingOrder(name) {
	// 对于不同任务需求，按照指定顺序尝试调用AI
	switch (name) {
		case 'detail-thinking':
			// 我们假设用户给龙胆设置的AI来源中，来源的智商顺序以以下顺序排列：
			// 详细思考模型，专家模型，正经使用模型，网页浏览模型，色情模型，简易逻辑模型
			// 在详细思考任务中，我们以此顺序回落AI来源
			return ['detail-thinking', 'expert', 'sfw', 'web-browse', 'nsfw', 'logic']
		case 'web-browse':
			// 在网页浏览任务中，我们优先调用网页浏览模型，再以智商顺序回落AI来源
			return ['web-browse', 'detail-thinking', 'expert', 'sfw', 'nsfw', 'logic']
		case 'expert':
			// 在专家任务中，我们优先调用专家模型，再以智商顺序回落AI来源
			return ['expert', 'detail-thinking', 'sfw', 'web-browse', 'nsfw', 'logic']
		case 'sfw':
			// 在普通但非色情任务中，我们在正经使用模型回落时优先使用专家模型或详细思考模型以获得最好的结果，之后按智商顺序回落
			return ['sfw', 'expert', 'detail-thinking', 'web-browse', 'nsfw', 'logic']
		case 'nsfw':
			// 在色情任务中，我们假设正经使用模型或专家模型难以产出优质文本，而逻辑模型则是次优解
			return ['nsfw', 'logic', 'web-browse', 'sfw', 'expert', 'detail-thinking']
		case 'logic':
			// 在逻辑判断中，我们使用智商顺序的倒序来回落调用，以最大程度减少不必要的算力损耗
			return ['logic', 'nsfw', 'web-browse', 'sfw', 'expert', 'detail-thinking']
	}
}

/**
 * @param {string} name
 * @param {(source:AIsource_t) => Promise<string>} caller
 * @param {number} trytimes
 * @param {(err: Error) => Promise<void>} error_logger
 * @returns {Promise<string>}
 */
export async function OrderedAISourceCalling(name, caller, trytimes = 3, error_logger = console.error) {
	let sources = [...new Set(GetAISourceCallingOrder(name).map(x => AIsources[x]).filter(x => x))]
	let lastErr
	for (let source of sources)
		for (let i = 0; i < trytimes; i++)
			try {
				console.info('OrderedAISourceCalling', name, getPartInfo(source).name)
				let result = await caller(source)
				return result
			} catch (err) {
				await error_logger(lastErr = err)
			}

	throw lastErr
}
