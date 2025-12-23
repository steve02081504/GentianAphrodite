/** @typedef {import('../../../../../../src/decl/TranslateSource.ts').TranslateSource_t} TranslateSource_t */

import { loadAnyPreferredDefaultPart, loadPart } from '../../../../../../src/server/parts_loader.mjs'
import { username } from '../charbase.mjs'

/**
 * @type {TranslateSource_t | null}
 */
export let translateSource = null

/**
 * 获取当前翻译源的配置数据。
 * @returns {string | null} 翻译源的文件名，如果没有则返回 null。
 */
export function getTranslateSourceData() {
	return translateSource?.filename || null
}

/**
 * 根据提供的数据设置并加载翻译源。
 * @param {string | null} sourceName - 翻译源的文件名，如果为 null 则使用默认翻译源。
 * @returns {Promise<void>}
 */
export async function setTranslateSourceData(sourceName) {
	if (sourceName)
		translateSource = await loadPart(username, 'serviceSources/translate/' + sourceName)
	else
		translateSource = await loadAnyPreferredDefaultPart(username, 'serviceSources/translate')
}
