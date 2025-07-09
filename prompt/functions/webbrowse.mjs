import { match_keys } from '../../scripts/match.mjs'
import { findUrlsInText, getUrlMetadata } from '../../scripts/web.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function WebBrowsePrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if (logical_results.in_assist || await match_keys(args, ['浏览', '访问', /https?:\/\//, '查看网页', /<web-browse>/i], 'any'))
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

		const all_metas = (await Promise.all(urls.map(async (url) => {
			const metas = await getUrlMetadata(url)
			if (metas?.length) return `\`${url}\`：\n${metas.join('\n')}`
		}))).filter(Boolean)

		if (all_metas.length) {
			log.extension.processedURLs = true
			log.logContextAfter ??= []
			log.logContextAfter.push({
				name: 'system',
				role: 'system',
				content: `\
上条消息中链接的元信息如下：
${all_metas.join('\n')}
`,
				charVisibility: [args.char_id]
			})
		}
	}

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
