import { unlockAchievement } from '../../scripts/achievements.mjs'
import { statisticDatas } from '../../scripts/statistics.mjs'
import { tryFewTimes } from '../../scripts/tryFewTimes.mjs'
import { searchSource } from '../../SearchSource/index.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * 处理来自 AI 的网络搜索请求。
 * @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t}
 */
export async function websearch(result, { AddLongTimeLog }) {
	// Match <web-search>...</web-search>
	const searchMatches = [...result.content.matchAll(/<web-search>(?<query>[^]*?)<\/web-search>/g)]
	if (searchMatches.length) {
		let processed = false
		for (const match of searchMatches) {
			let searchQueryContent = match.groups.query
			if (searchQueryContent) {
				unlockAchievement('use_websearch')
				statisticDatas.toolUsage.webSearches++
				searchQueryContent = searchQueryContent.trim()
				if (!searchQueryContent) {
					console.warn('Received <web-search> tag with empty content.')
					continue
				}

				AddLongTimeLog({
					name: '龙胆',
					role: 'char',
					content: '<web-search>' + searchQueryContent + '</web-search>',
					files: []
				})
				console.info('AI 搜索关键词：', searchQueryContent)

				try {
					// Split queries by newline, filter out empty lines
					const searchQueries = searchQueryContent.split('\n').map(q => q.trim()).filter(query => query)

					if (!searchQueries.length) {
						console.warn('<web-search> content resulted in no valid queries after splitting and filtering.')
						AddLongTimeLog({
							name: 'web-search',
							role: 'tool',
							content: '搜索指令 <web-search> 内未找到有效的搜索关键词。',
							files: []
						})
						processed = true
						continue
					}

					if (!searchSource) {
						AddLongTimeLog({
							name: 'web-search',
							role: 'tool',
							content: '搜索功能当前不可用：未找到可用的搜索源。请告知用户需要在配置中设置搜索源后才能使用此功能。',
							files: []
						})
						processed = true
						continue
					}

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

					processed = true // Indicate the search command was processed
				} catch (err) {
					console.error('web search failed:', err)
					AddLongTimeLog({
						name: 'web-search',
						role: 'tool',
						content: '搜索时出现错误：\n' + (err.stack || err.message || err),
						files: []
					})
					processed = true // Indicate the command was attempted but failed
				}
			}
		}
		return processed
	}

	return false // Indicate the tag was not found
}
