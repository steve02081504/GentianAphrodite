import { defineReplyHandler } from '../../../../../../../src/public/parts/shells/chat/src/reply/defineReplyHandler.mjs'
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

/**
 * 内容型 handler：命中角色设定泄露时整条替换为封禁提示并终止本轮。
 * @param {object} reply 回复对象
 * @param {object} args 请求上下文
 * @returns {Promise<object>} 结果
 */
async function roleSettingFilterHandle(reply, args) {
	const content = reply.content ?? ''
	if (base_match_keys(content, role_setting_match_keys) >= 3) {
		console.log('content blocked by rolesettingfilter:', content)
		args.AddLongTimeLog?.({
			name: 'rolesettingfilter',
			role: 'tool',
			content: '检测到疑似角色设定泄露输出，已替换为封禁提示。',
			files: []
		})
		return { content: blockedShowContent, stop: true }
	}
	return {}
}

/** @type {import("../../../../../../../src/decl/PluginAPI.ts").ReplyHandler_t} */
export const rolesettingfilter = defineReplyHandler({
	name: 'rolesettingfilter',
	phase: 'before',
	handle: roleSettingFilterHandle,
})
