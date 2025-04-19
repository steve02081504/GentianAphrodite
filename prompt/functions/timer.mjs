import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function TimerPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if (await match_keys(args, [
		/(定|计)时器/, '闹钟', '提醒我', '设置提醒', /到时间?提醒我/, /过(多久|一?阵)提醒我/, 'schedule', 'timer', /(分钟|小时|天|秒)后/, /<timer>/i
	], 'any'))
		result += `\
你可以通过回复以下格式来设置一个或多个定时器：
<timer>
	<item>
		<time>时间描述</time>
		<reason>提醒事由</reason>
	</item>
	<!-- 可以有多个 <item> -->
</timer>
时间单位可以是缩写/英文/中文，如：\`10min\`、\`1d3h2m\`、\`1周\`。
如：
<timer>
	<item>
		<time>10min</time>
		<reason>提醒主人喝水</reason>
	</item>
	<item>
		<time>1d</time>
		<reason>提醒主人检查邮件</reason>
	</item>
</timer>
这将设置2个不同的定时器。
定时器到期时会触发系统消息提醒你。
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
