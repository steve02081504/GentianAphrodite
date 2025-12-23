/** @typedef {import('../../../../../../src/decl/SearchSource.ts').SearchSource_t} SearchSource_t */

import { loadAnyPreferredDefaultPart, loadPart } from '../../../../../../src/server/parts_loader.mjs'
import { username } from '../charbase.mjs'

/**
 * @type {SearchSource_t | null}
 */
export let searchSource = null

/**
 * 获取当前搜索源的配置数据。
 * @returns {string | null} 搜索源的文件名，如果没有则返回 null。
 */
export function getSearchSourceData() {
	return searchSource?.filename || null
}

/**
 * 根据提供的数据设置并加载搜索源。
 * @param {string | null} sourceName - 搜索源的文件名，如果为 null 则使用默认搜索源。
 * @returns {Promise<void>}
 */
export async function setSearchSourceData(sourceName) {
	if (sourceName)
		searchSource = await loadPart(username, 'serviceSources/search/' + sourceName)
	else
		searchSource = await loadAnyPreferredDefaultPart(username, 'serviceSources/search')
}
