import { match_keys } from '../../scripts/match.mjs'
import { findUrlsInText, getUrlMetadata } from '../../scripts/web.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * @param {string[]} strings - 要检查的字符串数组。
 * @returns {string} - 最长公共前缀。
 */
function longestCommonPrefix(strings) {
	if (!strings.length) return ''
	let prefix = strings[0]
	for (const s of strings.slice(1))
		while (prefix && !s.startsWith(prefix))
			prefix = prefix.slice(0, -1)
	return prefix
}

/**
 * @param {string[]} strings - 要检查的字符串数组。
 * @returns {string} - 最长公共后缀。
 */
function longestCommonSuffix(strings) {
	const reversed = strings.map(s => [...s].reverse().join(''))
	const suffixRev = longestCommonPrefix(reversed)
	return [...suffixRev].reverse().join('')
}

/**
 * 将一组 URL 格式化为一个标签：单个则直接展示，多个则用最长公共前后缀 + 通配符。
 * @param {string[]} urlList - 要格式化的 URL 列表。
 * @returns {string} - 格式化后的标签字符串。
 */
function formatUrlListLabel(urlList) {
	if (urlList.length === 1) return `\`${urlList[0]}\``
	let prefix = longestCommonPrefix(urlList)
	const suffix = longestCommonSuffix(urlList)
	const minLen = Math.min(...urlList.map(u => u.length))
	const hasMiddle = prefix.length + suffix.length < minLen
	if (!hasMiddle) return `\`${urlList[0]}\``
	let mid = '*'
	if (suffix)
		mid = suffix.startsWith('/') ? '/*' : '*'
	else if (urlList.some(u => u.length > prefix.length && u[prefix.length] === '/'))
		prefix += '/'
	return `\`${prefix}${mid}${suffix}\``
}

/**
 * @param {string[]} urls - 要获取元数据的 URL 列表。
 * @returns {Promise<Array<{ url: string, metaText: string }>>} - 包含 URL 及其元数据文本的对象列表。
 */
async function fetchUrlMetaList(urls) {
	const results = await Promise.all(urls.map(async url => {
		const metas = await getUrlMetadata(url)
		if (metas?.length) return { url, metaText: metas.join('\n') }
		return null
	}))
	return results.filter(Boolean)
}

/**
 * @param {Array<{ url: string, metaText: string }>} urlMetaList - URL 元数据对象列表。
 * @returns {Map<string, string[]>} - 键为元数据文本、值为共享该元数据的 URL 列表的映射。
 */
function groupUrlsByMetaText(urlMetaList) {
	const metaToUrls = new Map()
	for (const { url, metaText } of urlMetaList) {
		const list = metaToUrls.get(metaText) ?? []
		list.push(url)
		metaToUrls.set(metaText, list)
	}
	return metaToUrls
}

/**
 * @param {Map<string, string[]>} metaToUrls - 元数据文本到 URL 列表的映射。
 * @returns {string[]} - 格式化后的字符串片段数组。
 */
function buildMetaParts(metaToUrls) {
	const parts = []
	for (const [metaText, urlList] of metaToUrls)
		parts.push(`${formatUrlListLabel(urlList)}：\n${metaText}`)
	return parts
}


/**
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑处理结果。
 * @returns {Promise<single_part_prompt_t>} - 网页浏览Prompt
 */
export async function WebBrowsePrompt(args, logical_results) {
	let result = ''

	if (args.extension?.enable_prompts?.webBrowse || logical_results.in_assist || await match_keys(args, ['浏览', '访问', /https?:\/\//, '查看网页', /<web-browse>/i], 'any'))
		result += `\
你可以浏览网页，但由于网页token过多，你需要用以下格式来调用网页浏览：
<web-browse>
	<url>网址</url>
	<question>问题内容</question>
</web-browse>
比如：
<web-browse>
	<url>https://github.com/ukatech/jsstp-lib</url>
	<question>这个项目都能做什么？使用方法大致是？</question>
</web-browse>
`

	const logs = args.chat_log.slice(-5)

	for (const log of logs) {
		if (log.extension?.processedURLs) continue
		const urls = findUrlsInText(log.content)
		const urlMetaList = await fetchUrlMetaList(urls)
		if (!urlMetaList.length) continue

		const metaToUrls = groupUrlsByMetaText(urlMetaList)
		const parts = buildMetaParts(metaToUrls)

		log.extension.processedURLs = true
		log.logContextAfter ??= []
		log.logContextAfter.push({
			name: 'system',
			role: 'system',
			content: `\
上条消息中链接的元信息如下：
${parts.join('\n')}
`,
			charVisibility: [args.char_id]
		})
	}

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
