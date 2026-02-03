import { match_keys } from '../../scripts/match.mjs'
import { findUrlsInText, getUrlMetadata } from '../../scripts/web.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

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

		const urlMetaList = (await Promise.all(urls.map(async url => {
			const metas = await getUrlMetadata(url)
			if (metas?.length) return { url, metaText: metas.join('\n') }
		}))).filter(Boolean)

		if (!urlMetaList.length) continue

		// 按元信息内容分组，相同元信息的 URL 用通配符合并
		const metaToUrls = new Map()
		for (const { url, metaText } of urlMetaList) {
			const list = metaToUrls.get(metaText) ?? []
			list.push(url)
			metaToUrls.set(metaText, list)
		}

		const parts = []
		for (const [metaText, urlList] of metaToUrls) {
			const label = urlList.length === 1
				? `\`${urlList[0]}\``
				: (() => {
					// 最长公共前缀
					let prefix = urlList[0]
					for (const u of urlList.slice(1)) {
						while (prefix && !u.startsWith(prefix)) prefix = prefix.slice(0, -1)
					}
					// 最长公共后缀（反转后求 LCP 再反转）
					const reversed = urlList.map(u => [...u].reverse().join(''))
					let suffixRev = reversed[0]
					for (const r of reversed.slice(1)) {
						while (suffixRev && !r.startsWith(suffixRev)) suffixRev = suffixRev.slice(0, -1)
					}
					const suffix = suffixRev ? [...suffixRev].reverse().join('') : ''

					const minLen = Math.min(...urlList.map(u => u.length))
					const hasMiddle = prefix.length + suffix.length < minLen
					if (!hasMiddle) return `\`${urlList[0]}\``

					// 通配：前缀 + * + 后缀，路径边界保留 /
					let mid = '*'
					if (suffix) {
						mid = suffix.startsWith('/') ? '/*' : '*'
					} else if (urlList.some(u => u.length > prefix.length && u[prefix.length] === '/'))
						prefix += '/'
					return `\`${prefix}${mid}${suffix}\``
				})()
			parts.push(`${label}：\n${metaText}`)
		}

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
