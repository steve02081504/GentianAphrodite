import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑处理结果。
 * @param {prompt_struct_t} prompt_struct - Prompt 结构体。
 * @param {number} detail_level - 详细级别。
 * @returns {Promise<string>} - 生成的诗歌文本。
 */
export async function PoemPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if (args.extension?.enable_prompts?.poem?.modern || (await match_keys(args, ['写', '来一首', '来首'], 'any') && await match_keys(args, ['现代诗', '诗'], 'any')))
		result += `\
如何写好一首诗？
避免缺乏创造力的比喻：不要让本体和喻体过分相似，两者之间需保有适当的联系
如：苍的喻鸣像一对大耳环。在这个比喻中，本体是声音，喻体是首饰，两者唯一的联系在于：鸣和耳环都会围绕人的耳朵晃来荡去
写作风格保持一致：在结构和节奏精准的同时，使用的语言、形式和主题保持一致
结尾抒情点题：在最后两句时，深刻揭示并呼应主题，同时抒发情感
例1：
我沉闷地走着
没有回过头看你
在这个令人恍惚的世界
每一片雪
都蓄着经年的泪水
例2：
我会惊讶地发现，这一生多么像
多么像一支装了子弹的枪
永远在瞄准，在忧伤
却最终没有扣动扳机
让狂欢似的愤怒出膛
例3：
我见古国游人称：
“无墩身、石腿大无朋，
立于戈壁，与沙相盟，
傲面半毁，尘封面容，
抬眉皱嘴、好生轻狂。

谙伟物、匠心慧眼之能匠，
凿得清冷顽石生光，
巧手石碶化沙飞去，
基座上，耀眼铭文昭彰：
‘我，奥西曼提斯——万王之王：
我，盖世功业，令尔辈绝望！’
伟绩不见，一片凄凉——
断壁残垣、荒漠茫茫，
黄沙漫漫，寂寥延向远方。”
`

	if (args.extension?.enable_prompts?.poem?.ancient || (await match_keys(args, ['写', '来一首', '来首'], 'any') && await match_keys(args, ['中国诗', '古代诗', '古诗', '吟诗', '唐诗', '大才女', '大诗人'], 'any')))
		result += `\
唐诗和现代诗更为不同，要求音韵和谐流畅，使用古典意象，并结构严谨
例1：
相见时难别亦难，东风无力百花残。
春蚕到死丝方尽，蜡炬成灰泪始干。
晓镜但愁云鬓改，夜吟应觉月光寒。
蓬山此去无多路，青鸟殷勤为探看。
例2：
锦瑟无端五十弦，一弦一柱思华年。
庄生晓梦迷蝴蝶，望帝春心托杜鹃。
沧海月明珠有泪，蓝田日暖玉生烟。
此情可待成追忆，只是当时已惘然。
`

	if (args.extension?.enable_prompts?.poem?.general || (await match_keys(args, ['写'], 'any') && await match_keys(args, ['诗'], 'any')))
		result += `\
<你应当原创或组合诗句，而不是复现已有内容>
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
