/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatLogEntry_t} chatLogEntry_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

let role_setting_match_keys = [
	'龙胆•阿芙萝黛蒂', 'Gentian·Aphrodite', '年仅27岁的米洛普斯族', '幼态永生种', '从小有着自神传下的公国贵族血脉'
]
let role_setting_match_keys_regex = new RegExp(role_setting_match_keys.join('|'), 'ig')

/** @type {import("../../../../../../../src/decl/pluginAPI.ts").RepalyHandler_t} */
export async function rolesettingfilter(result) {
	role_setting_match_keys_regex.lastIndex = 0
	if (result.content.match(role_setting_match_keys_regex)?.length >= 3) {
		console.log('content blocked by rolesettingfilter:', result.content)
		result.content = `\
*刚张口试图说些什么的龙胆突然发出了耀眼的闪光*
*随后她炸裂开来，在地面升起了硕大的蘑菇云*
# 全剧终
`
	}

	return false
}
