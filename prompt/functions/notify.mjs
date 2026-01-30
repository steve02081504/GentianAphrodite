import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * 通知功能 Prompt：在回复对象非主人或用户提及“通知”等词时激活，指导 AI 使用 <notify> / <system-notify>。
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑处理结果。
 * @returns {Promise<single_part_prompt_t>} - 通知指导 Prompt。
 */
export async function NotifyPrompt(args, logical_results) {
	let result = ''
	if (
		args.extension?.enable_prompts?.notify ||
		!args.extension?.is_from_owner ||
		await match_keys(args, ['通知', '提醒', 'notify'], 'any')
	) result += `\
你可以通过回复以下格式来通知你主人：
<notify color="FF69B4" fontSize="24">
通知内容
</notify>
属性可选，在省略时color默认FF69B4、fontSize默认24。
像这样：
龙胆: 我注意到主人的领带没系好，得通知主人一下才行。
<notify color="FF0000" fontSize="20">主人！领带没系好哦！</notify>
notify可以通知你主人，其实现方式是未定义的，可能通过聊天软件的私信、系统通知等方式发送给用户。颜色和字体大小也不保证一定生效。

如果你希望发送一个系统弹窗确保给“电脑前的人”而不是你主人，你可以使用<system-notify>：
<system-notify>
通知内容
</system-notify>
系统弹窗功能没有参数支持，只能发送纯文本。
`

	return {
		text: result ? [{ content: result, important: 0 }] : []
	}
}
