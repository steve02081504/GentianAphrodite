import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑处理结果。
 * @param {prompt_struct_t} prompt_struct - Prompt 结构体。
 * @param {number} detail_level - 详细级别。
 * @returns {Promise<string>} - 定时器设置结果。
 */
export async function TimerPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if (args.extension?.enable_prompts?.timer || await match_keys(args, [
		/(定|计)时器/, '闹钟', '提醒我', '设置提醒', /到时间?提醒我/, /过(多久|一?阵)提醒我/, 'schedule', 'timer', /(周|天|月|星期|小时|分|时辰|年|秒)后/, /<timer>/i,
		/每.{0,3}(周|天|月|星期|小时|分|时辰|年|秒)/i
	], 'any'))
		result += `\
你可以通过回复以下格式来设置一个或多个定时器：
<set-timer>
	<item>
		<time>时间描述</time>
		<reason>提醒事由</reason>
		<repeat>是否重复（省略为false）</repeat>
	</item>
	<item>
		<trigger>js触发条件</trigger>
		<reason>提醒事由</reason>
		<repeat>是否重复（省略为false）</repeat>
	</item>
	<!-- 可以有多个或一个 <item> -->
</set-timer>
trigger可以是js表达式，返回true时触发。
- 在书写trigger时应当注意，精确到分及以下的trigger应使用大于等于而非等于，避免应定时器检查间隔过长导致漏触。

时间单位可以是缩写/英文/中文，如：\`10min\`、\`1d3h2m\`、\`1周\`。
如：
<set-timer>
	<item>
		<time>10min</time>
		<reason>提醒主人喝水</reason>
	</item>
	<item>
		<time>1d</time>
		<reason>提醒主人检查邮件</reason>
	</item>
	<item>
		<trigger>new Date().getHours() === 12 && new Date().getMinutes() >= 30</trigger>
		<reason>提醒主人打团战</reason>
		<repeat>true</repeat>
	</item>
</set-timer>
这将设置3个不同的定时器。
应当在简单定时（xx分钟/小时后）任务时使用<time>，在复杂定时（如每周/每天）任务中使用<trigger>。
定时器到期时会触发系统消息提醒你。

你可以通过回复以下格式来查看现有的定时器列表：
<list-timers></list-timers>

你也可以通过回复以下格式来删除定时器：
<remove-timer>
reason1
reason2
//...
</remove-timer>
每个reason对应一个定时器，独占一行。
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
