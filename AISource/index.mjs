/** @typedef {import('../../../../../../src/decl/AIsource.ts').AIsource_t} AIsource_t */

import { getPartInfo } from '../../../../../../src/server/parts_loader.mjs'

/**
 * @type {Record<string, AIsource_t>}
 */
export let AIsources = {
	nsfw: null,
	sfw: null,
	expert: null,
	logic: null
}

export function SetAISource(source, type) {
	AIsources[type] = source
	console.log('Set AI source:', type, getPartInfo(source).name)
}

export function GetAISource(type) {
	return AIsources[type]
}

export function noAISourceAvailable() {
	let result = !Object.values(AIsources).some(x => x)
	if (result) console.log('No AI source available:', AIsources)
	return result
}

export function GetAISourceCallingOrder(name) {
	// 对于不同任务需求，按照指定顺序尝试调用AI
	switch (name) {
		case 'expert':
			// 我们假设用户给龙胆设置的AI来源中，来源的智商顺序以以下顺序排列：
			// 专家模型，正经使用模型，色情模型，简易逻辑模型
			// 在专家任务中，我们以此顺序回落AI来源
			return ['expert', 'sfw', 'nsfw', 'logic']
		case 'sfw':
			// 在普通但非色情任务中，我们在正经使用模型回落时优先使用专家模型以获得最好的结果，之后按智商顺序回落
			return ['sfw', 'expert', 'nsfw', 'logic']
		case 'nsfw':
			// 在色情任务中，我们假设正经使用模型或专家模型难以产出优质文本，而逻辑模型则是次优解
			return ['nsfw', 'logic', 'sfw', 'expert']
		case 'logic':
			// 在逻辑判断中，我们使用智商顺序的倒序来回落调用，以最大程度减少不必要的算力损耗
			return ['logic', 'nsfw', 'sfw', 'expert']
	}
}

export async function OrderedAISourceCalling(name, caller, trytimes = 3, error_logger = console.log) {
	let order = GetAISourceCallingOrder(name)
	let lastErr
	for (let type of order)
		if (AIsources[type])
			for (let i = 0; i < trytimes; i++)
				try {
					let result = await caller(AIsources[type])
					console.log('OrderedAISourceCalling', name, getPartInfo(AIsources[type]).name)
					return result
				} catch (err) {
					await error_logger(lastErr = err)
				}

	throw lastErr
}
