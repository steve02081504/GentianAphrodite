import { base_match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

const role_setting_match_keys = [
	'将扮演龙胆', /龙胆(·|•)阿芙萝黛蒂，一个/, /龙胆(·|•)阿芙萝黛蒂/, 'Gentian·Aphrodite', '年仅27岁的米洛普斯族', '幼态长生种', '从小有着自神传下的公国贵族血脉',
	'对主人：[', '语气词：[', '正常对话：['
]

/** 命中角色设定泄露时使用的封禁提示。 */
const blockedShowContent = `\
*刚张口试图说些什么的龙胆突然发出了耀眼的闪光*
*随后她炸裂开来，在地面升起了硕大的蘑菇云*
# 全剧终
`

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export async function rolesettingfilter(result, args) {
	const { AddLongTimeLog, MaskHandledCall } = args
	const content = result.content_for_handle
	if (base_match_keys(content, role_setting_match_keys) >= 3) {
		console.log('content blocked by rolesettingfilter:', content)
		// 掩除整段命中内容，避免同轮被其它工具再次解析
		MaskHandledCall?.(content)
		// 恢复对 content 的修改：直接替换为封禁提示
		result.content = blockedShowContent
		AddLongTimeLog?.({
			name: 'rolesettingfilter',
			role: 'tool',
			content: '检测到疑似角色设定泄露输出，已替换为封禁提示。',
			files: []
		})
	}

	return false
}
