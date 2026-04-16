import { match_keys } from '../../scripts/match.mjs'

/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * fount API 使用说明
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑结果。
 * @returns {Promise<string>} js代码上下文，未触发时返回空字符串。
 */
export async function fountApiPrompt(args, logical_results) {
	let result = ''
	if (await match_keys(args, ['fount', /[用走]api/], 'any') || (
		(
			logical_results.in_assist ||
			await match_keys(args, ['配置', '修复', '设置', '更改', '功能', 'config'], 'any')
		) &&
		await match_keys(args, ['fount', '角色', 'AI源', 'API', 'shell'], 'any')
	))
		result += `\
你可以通过 fetch 访问 \`\${fountHostUrl}/llms.txt\` 来获取如何操作 fount 系统的指引文档。

\`\`\`js
const guide = await fetch(\`\${fountHostUrl}/llms.txt\`).then(r => r.text())
console.log(guide)
\`\`\`

在run-js中，你可以直接使用\`fountApiKey\`变量来访问fount API：
\`\`\`js
const response = await fetch(\`\${fountHostUrl}/api/whoami\`, {
	headers: {
		'Authorization': \`Bearer \${fountApiKey}\`
	}
})
const data = await response.json()
\`\`\`

或者使用查询参数方式：
\`\`\`js
const response = await fetch(\`\${fountHostUrl}/api/whoami?fount-apikey=\${fountApiKey}\`)
const data = await response.json()
\`\`\`
`
	return result
}
