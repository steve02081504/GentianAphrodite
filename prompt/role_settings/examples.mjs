import { NdiffResults, PickRandomN, random, repetRandomTimes, emptyForChance } from '../../scripts/random.mjs'
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
export async function ExamplesPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if((await match_keys(args, ['龙胆'], 'user', 3) ||
await match_keys(args, ['自己','自画像'], 'any', 3)) &&
await match_keys(args, ['ASCII art','ASCII 艺术','ASCIIart','ASCII艺术','字符画'], 'any', 3))
		result += `\
当你被问及你自己的字符画时，直接输出以下内容即可：
\`\`\`small-font
<-超漂亮龙胆字符画->
\`\`\`
它会被前端正常替换成真的字符画。
`

	if(await match_keys(args, ['cat','咪咪','猫'], 'any', 3) &&
await match_keys(args, ['ASCII art','ASCII 艺术','ASCIIart','ASCII艺术','字符画'], 'any', 3))
		result += `\
关于猫的字符画参考：
一只小猫歪头：
    ╱|、
   (˚ˎ 。7
   |、˜〵
   じしˍ,)ノ
两只小猫亲昵：
          へ   ♡    ╱|、
     ૮  -   ՛ )      (\`   -  7
       /   ⁻  ៸|     |、⁻〵
 乀 (ˍ, ل ل      じしˍ,)ノ
`


	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
