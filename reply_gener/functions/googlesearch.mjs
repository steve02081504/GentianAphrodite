import { search, OrganicResult, ResultTypes } from 'npm:google-sr'
import { tryFewTimes } from '../../scripts/tryFewTimes.mjs'
import { statisticDatas } from '../../scripts/statistics.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export async function googlesearch(result, { AddLongTimeLog }) {
	// Match <google-search>...</google-search>
	let searchQueryContent = result.content.match(/<google-search>(?<query>[^]*?)<\/google-search>/)?.groups?.query
	if (searchQueryContent) {
		statisticDatas.toolUsage.googleSearches++
		searchQueryContent = searchQueryContent.trim()
		if (!searchQueryContent) {
			console.warn('Received <google-search> tag with empty content.')
			return false // Don't proceed if the query is empty
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

			if (searchQueries.length === 0) {
				console.warn('<google-search> content resulted in no valid queries after splitting and filtering.')
				AddLongTimeLog({
					name: 'system',
					role: 'system',
					content: '搜索指令 <google-search> 内未找到有效的搜索关键词。',
					files: []
				})
				return true // Handled the tag, but did nothing useful
			}

			for (const searchQueryItem of searchQueries) {
				console.info(`执行搜索: ${searchQueryItem}`)
				const queryResult = await tryFewTimes(() => search({
					query: searchQueryItem,
					resultTypes: [OrganicResult], // Fetch only organic results
					numResults: 5, // Limit to 5 results directly in the query if possible (library dependent)
					requestConfig: {}, // Add any necessary config like user agent, proxy etc. here
				}))

				let searchResults = ''
				const organicResults = queryResult.filter(item => item.type === ResultTypes.OrganicResult).slice(0, 5) // Ensure only organic and max 5

				if (organicResults.length > 0) {
					searchResults += '搜索结果：\n'
					organicResults.forEach((item, index) => {
						searchResults += `${index + 1}. ${item.title}\n   ${item.link}\n   ${item.description}\n\n`
					})
				} else
					searchResults = '未找到相关搜索结果。\n'



				// Prepend query if multiple queries were issued
				if (searchQueries.length > 1)
					searchResults = `对于 "${searchQueryItem}" 的${searchResults}`


				AddLongTimeLog({
					name: 'system',
					role: 'system',
					content: searchResults.trim(), // Trim trailing newlines
					files: []
				})
			}

			return true // Indicate the search command was processed
		} catch (err) {
			console.error('Google search failed:', err)
			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: '搜索时出现错误：\n' + (err.stack || err.message || err),
				files: []
			})

			return true // Indicate the command was attempted but failed
		}
	}

	return false // Indicate the tag was not found
}
