import { unlockAchievement } from '../../scripts/achievements.mjs'
import { statisticDatas } from '../../scripts/statistics.mjs'
import { tryFewTimes } from '../../scripts/tryFewTimes.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * 处理来自 AI 的谷歌搜索请求。
 * @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t}
 */
export async function googlesearch(result, { AddLongTimeLog }) {
	// Match <google-search>...</google-search>
	const searchMatches = [...result.content.matchAll(/<google-search>(?<query>[^]*?)<\/google-search>/g)]
	if (searchMatches.length) {
		let processed = false
		for (const match of searchMatches) {
			let searchQueryContent = match.groups.query
			if (searchQueryContent) {
				const { search, OrganicResult } = await import('npm:google-sr@^6.0.0')
				unlockAchievement('use_googlesearch')
				statisticDatas.toolUsage.googleSearches++
				searchQueryContent = searchQueryContent.trim()
				if (!searchQueryContent) {
					console.warn('Received <google-search> tag with empty content.')
					continue
				}

				AddLongTimeLog({
					name: '龙胆',
					role: 'char',
					content: '<google-search>' + searchQueryContent + '</google-search>',
					files: []
				})
				console.info('AI 搜索关键词：', searchQueryContent)

				try {
					// Split queries by newline, filter out empty lines
					const searchQueries = searchQueryContent.split('\n').map(q => q.trim()).filter(query => query)

					if (!searchQueries.length) {
						console.warn('<google-search> content resulted in no valid queries after splitting and filtering.')
						AddLongTimeLog({
							name: 'google-search',
							role: 'tool',
							content: '搜索指令 <google-search> 内未找到有效的搜索关键词。',
							files: []
						})
						processed = true
						continue
					}

					for (const searchQueryItem of searchQueries) {
						console.info(`执行搜索: ${searchQueryItem}`)
						const queryResult = await tryFewTimes(() => search({
							query: searchQueryItem,
							parsers: [OrganicResult],
							requestConfig: {},
						}))

						const organicResults = queryResult.filter(item => !item.isAd).slice(0, 5)

						let searchResults = ''
						if (organicResults.length) {
							searchResults += '搜索结果：\n'
							organicResults.forEach((item, index) => {
								const source = item.source ? `[${item.source}] ` : ''
								searchResults += `${index + 1}. ${source}${item.title}\n   ${item.link}\n`
								if (item.description)
									searchResults += `${item.description}\n`
							})
						}
						else searchResults = '未找到相关搜索结果。\n'

						// Prepend query if multiple queries were issued
						if (searchQueries.length > 1)
							searchResults = `对于 "${searchQueryItem}" 的${searchResults}`

						AddLongTimeLog({
							name: 'google-search',
							role: 'tool',
							content: searchResults.trim(), // Trim trailing newlines
							files: []
						})
					}

					processed = true // Indicate the search command was processed
				} catch (err) {
					console.error('Google search failed:', err)
					AddLongTimeLog({
						name: 'google-search',
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
