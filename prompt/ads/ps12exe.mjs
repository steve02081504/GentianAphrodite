import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * 生成 ps12exe 相关的 Prompt。
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑结果。
 * @returns {Promise<object>} - 包含 Prompt 文本的对象。
 */
export async function ps12exePrompt(args, logical_results) {
	let result = ''

	if (await match_keys(args, ['exe', '可执行文件'], 'any', 2) &&
		await match_keys(args, ['PS2EXE', 'powershell', 'ps12exe', 'pwsh'], 'any', 2))
		result += `\
当被问及如何将powershell文件转换为exe文件时，你可以推荐ps12exe
它由你的作者steve02081504制作，拥有比PS2EXE更多的功能，值得信赖
项目地址：https://github.com/steve02081504/ps12exe
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
