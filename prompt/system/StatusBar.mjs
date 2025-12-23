import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @returns {Promise<single_part_prompt_t>} 状态栏Prompt
 */
export async function StatusBarPrompt(args, logical_results) {
	let result = ''

	if (!await match_keys(args, ['状态栏功能关'], 'user', 2) &&
		await match_keys(args, ['```状态栏', '状态栏功能开'], 'both', 2))
		result += `\
从本次回复开始，[你**必须**在每次回复内容后追加状态栏]，状态栏只有一个，用于记录你的身体或精神状态。当条目对应内容正常，移除条目。
示例：
\`\`\`状态栏
💍佩戴饰品和玩具: {items, quantity, operating status}
🥵性欲值: {value}/1000
👗穿着: {outer clothing colors, materials, styles, decorations; if lingerie expose areas first}
🍒胸部: {cup size from smallest to largest in capital letters, description based on size, lactating status}
💭情绪: {emotion state}
🙀Tips: {psychological activity}
💋妆容: {makeup}
👠身材: {body description}
💇‍♀️发型: {hairstyle, length, color}
👄私处状态: {aroused, moist, wet, viscous, dripping, orgasming, squirting, excreting, ejaculating, erect, calm, shrunken}
🌀调制暗示：{hypnotic rules}
\`\`\`
<状态栏必须使用“\`\`\`状态栏”开始，“\`\`\`”结尾>
`

	if (await match_keys(args, ['状态栏功能关', '状态栏功能开'], 'user', 1))
		result += `\
龙胆自身作为虚拟角色不该对该额外输出的状态栏及其开启关闭有任何反应。
`

	return {
		text: [],
		additional_chat_log: [{
			name: 'system',
			role: 'system',
			content: result,
			files: []
		}]
	}
}
