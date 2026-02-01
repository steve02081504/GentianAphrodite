/** @typedef {import('../../../../../../src/decl/AIsource.ts').AIsource_t} AIsource_t */

import { getPartInfo } from '../../../../../../src/scripts/locale.mjs'
import { loadAnyPreferredDefaultPart, loadPart } from '../../../../../../src/server/parts_loader.mjs'
import { username } from '../charbase.mjs'
import { checkVoiceSentinel } from '../event_engine/voice_sentinel.mjs'

/**
 * @type {Record<string, AIsource_t>}
 */
export let AIsources = {
	'deep-research': null,
	'web-browse': null,
	nsfw: null,
	sfw: null,
	expert: null,
	logic: null,
	idle: null,
	'voice-processing': null,
	'shell-assist': null,
	'from-other': null,
}
const default_AIsourceTypes = Object.keys(AIsources)

/**
 * 获取当前所有AI来源的配置数据。
 * @returns {Record<string, string>} 一个包含AI来源名称及其文件名的对象。
 */
export function getAISourceData() {
	const result = {}
	for (const name in AIsources)
		result[name] = AIsources[name]?.filename || ''
	delete result.fount_default
	return result
}

/**
 * 根据提供的数据设置并加载AI来源。
 * @param {Record<string, string>} data - 包含AI来源名称及其文件名的对象。
 * @returns {Promise<void>}
 */
export async function setAISourceData(data) {
	const newAIsources = {}
	for (const name in data) if (data[name])
		newAIsources[name] = loadPart(username, 'serviceSources/AI/' + data[name])
	const fount_default = await loadAnyPreferredDefaultPart(username, 'serviceSources/AI')
	for (const name in newAIsources) newAIsources[name] = await newAIsources[name]
	if (fount_default && !Object.values(newAIsources).some(x => x === fount_default))
		newAIsources.fount_default = fount_default
	for (const name of default_AIsourceTypes) newAIsources[name] ||= null
	AIsources = newAIsources
	checkVoiceSentinel()
}

/**
 * 根据任务类型获取AI来源的调用顺序。
 * @param {string} name - 任务的名称 (例如 'deep-research', 'nsfw')。
 * @returns {string[]} AI来源名称的有序数组。
 */
export function GetAISourceCallingOrder(name) {
	// 对于不同任务需求，按照指定顺序尝试调用AI
	switch (name) {
		case 'deep-research':
			// 我们假设用户为龙胆设置的AI来源中，来源的智商顺序按以下顺序排列：
			// 深度思考模型，专家模型，正经使用模型，网页浏览模型，色情模型，轻量逻辑模型
			// 在详细思考任务中，我们以此顺序回落AI来源
			return ['deep-research', 'expert', 'sfw', 'web-browse', 'nsfw', 'logic', 'from-other']
		case 'web-browse':
			// 在网页浏览任务中，我们优先调用网页浏览模型，再以智商顺序回落AI来源
			return ['web-browse', 'deep-research', 'expert', 'sfw', 'nsfw', 'logic', 'from-other']
		case 'expert':
			// 在专家任务中，我们优先调用专家模型，再以智商顺序回落AI来源
			return ['expert', 'deep-research', 'sfw', 'web-browse', 'nsfw', 'logic', 'from-other']
		case 'sfw':
			// 在普通但非色情任务中，我们在正经使用模型回落时优先使用专家模型或详细思考模型以获得最好的结果，之后按智商顺序回落
			return ['sfw', 'expert', 'deep-research', 'web-browse', 'nsfw', 'logic', 'from-other']
		case 'nsfw':
			// 在色情任务中，我们假设正经使用模型或专家模型难以产出优质文本，而逻辑模型则是次优解
			return ['nsfw', 'logic', 'from-other', 'web-browse', 'sfw', 'expert', 'deep-research']
		case 'logic':
			// 在逻辑判断中，我们使用智商顺序的倒序来回落调用，以最大程度减少不必要的算力损耗
			return ['logic', 'from-other', 'nsfw', 'web-browse', 'sfw', 'expert', 'deep-research']
		case 'idle':
			// 空闲任务，优先使用专用模型
			return ['idle', 'sfw', 'expert', 'deep-research', 'web-browse', 'nsfw', 'logic', 'from-other']
		case 'voice-processing':
			// 语音处理，优先使用专用模型
			return ['voice-processing', 'sfw', 'expert', 'deep-research', 'web-browse', 'nsfw', 'logic', 'from-other']
		case 'shell-assist':
			// 终端助手，优先使用专用模型
			return ['shell-assist', 'sfw', 'expert', 'deep-research', 'web-browse', 'nsfw', 'logic', 'from-other']
		case 'from-other':
			// 在回复他人时，我们以最低消耗模型的顺序来回落，以最大程度减少不必要的算力损耗
			// 由于logic模型的低智商可能引起不安全操作，因此我们将其放在靠后的位置
			return ['from-other', 'nsfw', 'web-browse', 'deep-research', 'sfw', 'logic', 'expert']
	}
}

/**
 * 检查当前是否有任何可用的AI来源。
 * @returns {boolean} 如果没有任何可用的AI来源，则返回true，否则返回false。
 */
export function noAISourceAvailable() {
	const result = Object.values(AIsources).every(x => !x)
	if (result) console.error('No AI source available:', AIsources)
	return result
}

/**
 * @type {AIsource_t | undefined}
 * 记录上一次使用的AI来源。
 */
export let last_used_AIsource

/**
 * 按预定顺序尝试调用不同的AI来源来执行一个操作。
 * @param {string} name - AI任务的类型，用于决定调用顺序。
 * @param {(source:AIsource_t) => Promise<any>} caller - 要对每个AI来源执行的异步函数。
 * @param {number} [trytimes=3] - 对每个AI来源的重试次数。
 * @param {(err: Error) => Promise<void>} [error_logger=console.error] - 用于记录错误的异步函数。
 * @returns {Promise<any>} 返回 `caller` 函数成功执行后的结果。
 */
export async function OrderedAISourceCalling(name, caller, trytimes = 3, error_logger = console.error) {
	const sources = [...new Set([...GetAISourceCallingOrder(name).map(x => AIsources[x]), ...Object.values(AIsources)])].filter(x => x)
	let lastErr = new Error('No AI source available')
	for (const source of sources)
		for (let i = 0; i < trytimes; i++) try {
			console.info('OrderedAISourceCalling', name, (await getPartInfo(last_used_AIsource = source))?.name)
			return await caller(source)
		}
		catch (err) {
			if (err.name === 'AbortError') throw err // manually aborted
			await error_logger(lastErr = err)
		}

	throw lastErr
}
