import { search, OrganicResult, ResultTypes } from 'npm:google-sr'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").RepalyHandler_t} */
export async function googlesearch(result, { AddLongTimeLog }) {
	let searchQuery = result.content.match(/```google-search\n(?<query>[^]*?)\n```/)?.groups?.query
	if (searchQuery) {
		AddLongTimeLog({
			name: '龙胆',
			role: 'char',
			content: '```google-search\n' + searchQuery + '\n```',
			files: []
		})

		try {
			searchQuery = searchQuery.split('\n').filter((query) => !['```', '```google-search'].includes(query))
			for (const searchQueryItem of searchQuery) {
				const queryResult = await search({
					query: searchQueryItem,
					resultTypes: [OrganicResult],
					requestConfig: {},
				})

				let searchResults = '搜索结果：\n\n'
				queryResult.slice(0, 5).forEach((item, index) => {
					if (item.type === ResultTypes.OrganicResult)
						searchResults += `${index + 1}. ${item.title}\n${item.link}\n${item.description}\n\n`
				})
				if (searchQuery.length > 1)
					searchResults = `${searchQueryItem} 的${searchResults}`

				AddLongTimeLog({
					name: 'system',
					role: 'system',
					content: searchResults,
					files: []
				})
			}

			return true
		} catch (err) {
			AddLongTimeLog({
				name: 'system',
				role: 'system',
				content: '搜索时出现错误：\n' + err,
				files: []
			})
		}
	}

	return false
}
