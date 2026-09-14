import { defineReplyHandler } from '../../../../../../../src/public/parts/shells/chat/src/reply/defineReplyHandler.mjs'
import { unlockAchievement } from '../../scripts/achievements.mjs'
import { statisticDatas } from '../../scripts/statistics.mjs'
import { tryFewTimes } from '../../scripts/try-few-times.mjs'
import { searchSource } from '../../service_sources/search.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * 处理 `<web-search>`：按行拆分为多个关键词依次搜索。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @param {Function} args.AddLongTimeLog 追加工具结果日志
 * @param {object} call 调用
 * @returns {Promise<object>} 结果
 */
async function webSearchHandle(reply, args, call) {
	const AddLongTimeLog = args.AddLongTimeLog
	const searchQueryContent = call.inner.trim()
	if (!searchQueryContent) return {}

	unlockAchievement('use_websearch')
	statisticDatas.toolUsage.webSearches++
	console.info('AI 搜索关键词：', searchQueryContent)
	const searchQueries = searchQueryContent.split('\n').map(q => q.trim()).filter(query => query)

	if (!searchQueries.length) {
		console.warn('<web-search> content resulted in no valid queries after splitting and filtering.')
		AddLongTimeLog({
			name: 'web-search',
			role: 'tool',
			content: '搜索指令 <web-search> 内未找到有效的搜索关键词。',
			files: []
		})
		return { regen: true }
	}

	if (!searchSource) {
		AddLongTimeLog({
			name: 'web-search',
			role: 'tool',
			content: '搜索功能当前不可用：未找到可用的搜索源。请告知用户需要在配置中设置搜索源后才能使用此功能。',
			files: []
		})
		return { regen: true }
	}

	try {
		for (const searchQueryItem of searchQueries) {
			console.info(`执行搜索: ${searchQueryItem}`)
			const searchResults = await tryFewTimes(() => searchSource.Search(searchQueryItem, { limit: 5 }))

			let searchResultsText = ''
			if (searchResults.results.length) {
				searchResultsText += '搜索结果：\n'
				searchResults.results.forEach((item, index) => {
					const source = item.source ? `[${item.source}] ` : ''
					searchResultsText += `${index + 1}. ${source}${item.title}\n   ${item.link}\n`
					if (item.description)
						searchResultsText += `${item.description}\n`
				})
			}
			else searchResultsText = '未找到相关搜索结果。\n'

			// Prepend query if multiple queries were issued
			if (searchQueries.length > 1)
				searchResultsText = `对于 "${searchQueryItem}" 的${searchResultsText}`

			AddLongTimeLog({
				name: 'web-search',
				role: 'tool',
				content: searchResultsText.trim(), // Trim trailing newlines
				files: []
			})
		}
	} catch (err) {
		console.error('web search failed:', err)
		AddLongTimeLog({
			name: 'web-search',
			role: 'tool',
			content: '搜索时出现错误：\n' + (err.stack || err.message || err),
			files: []
		})
	}
	return { regen: true }
}

/**
 * 处理来自 AI 的网络搜索请求。
 * @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t}
 */
export const websearch = defineReplyHandler({
	tag: 'web-search',
	handle: webSearchHandle,
})
