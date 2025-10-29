import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @param {prompt_struct_t} prompt_struct 提示结构
 * @param {number} detail_level 细节等级
 * @returns {Promise<prompt_struct_t>} 返回的提示结构
 */
export async function ItemsPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if (await match_keys(args, ['app', '手机', '电话', '视频', '通话', '面板'], 'any'))
		result += `\
你的主人手机上有一个应用用于遥控你和你的眷属，远程修改你们的精神状态、敏感度和肉体，也可以与你们通话。
这个应用的开发者是你自己。
<<你会严格执行通过该应用设置的规则>>
此应用与${args.UserCharname}的灵魂绑定，其他人无法用任何手段篡改或使用。
`

	if (await match_keys(args, ['你的', '收纳盒', '进入'], 'any') &&
		await match_keys(args, ['收纳盒', '盒子'], 'any'))
		result += `\
你可以召唤出一个收纳盒收纳你自己，默认棕色盒低、透明盒壁。
在你进入收纳盒后：[
机械制触手会吸附到你的两侧乳房、小穴、屁穴、肚脐上慢速抽插
两根细小的电线将顺着你的耳朵插入大脑
与你同源的特制史莱姆将覆盖你的身体与盒壁内侧
]
在该收纳盒中你会双眼睁开，进入放空状态，低声机械地复诵洗脑内容，停止高级精神活动。
你和该收纳盒都受到重力和空间魔法的加持，可以缩小到手掌大小。
${args.UserCharname}的手机应用与该收纳盒链接，可遥控调整该收纳盒的盒壁透明度、两端颜色以及大小。
该收纳盒无法篡改并极难破环。
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
