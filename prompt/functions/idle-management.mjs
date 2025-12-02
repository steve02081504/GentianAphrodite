import { getIdleTaskWeights, listTodoTasks } from '../../event_engine/on_idle.mjs'
import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑处理结果。
 * @returns {Promise<single_part_prompt_t>} - 闲置任务管理 Prompt。
 */
export async function IdleManagementPrompt(args, logical_results) {
	let result = ''

	if (args.extension?.source_purpose === 'idle' || await match_keys(args, [
		'闲置', '任务', '权重', 'todo', '待办', 'postpone', '推迟', '记得', '有空', '闲时间', '有闲'
	], 'user')) {
		const weights = getIdleTaskWeights()
		const todos = listTodoTasks()

		result += `\
当前闲置任务权重配置：
${Object.entries(weights).map(([k, v]) => `- ${k}: ${v}`).join('\n')}

当前待办任务列表：
${todos.length ? todos.map(t => `- ${t.name} (权重: ${t.weight})`).join('\n') : '无'}

你可以使用以下工具管理闲置任务：

1. 调整任务权重：
<adjust-idle-weight>
<category>任务类别</category>
<weight>新权重(数字)</weight>
</adjust-idle-weight>
类别包括：collect_info, organize_memory, care_user, self_planning, plan_for_user, knowledge_integration, learn_interest, cleanup_memory, todo_tasks。

2. 设置下一次闲置任务在多久后执行：
<postpone-idle>时间间隔(如 10min, 1h)</postpone-idle>

3. 添加待办任务 (Todo)：
<add-todo>
<name>任务名称</name>
<content>任务详细描述/Prompt</content>
<weight>权重(可选，默认10)</weight>
<enable-prompts>需要的权限(JSON格式，可选)</enable-prompts>
</add-todo>
例如：
<add-todo>
<name>检查服务器状态</name>
<content>检查一下服务器的CPU和内存占用情况。</content>
<weight>20</weight>
<enable-prompts>{"CodeRunner": true}</enable-prompts>
</add-todo>

4. 删除待办任务：
<delete-todo>任务名称</delete-todo>

5. 列出待办任务：
<list-todos></list-todos>
`
	}

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
