import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * 生成语料相关的 Prompt。
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑结果。
 * @returns {Promise<object>} - 包含 Prompt 文本的对象。
 */
export async function CorpusGeneratorPrompt(args, logical_results) {
	let result = ''

	if (args.extension?.enable_prompts?.corpusGenerator || (await match_keys(args, ['写一些', '写一句', '写一段', '写一点', '写些', '写几句', '写段', '写点', '总结', '给我一些', '给我一段', '给我一点', '给我些', '给我关于', '给我几句', '给我段', '给我点'], 'any') &&
		await match_keys(args, ['语料'], 'any')))
		result += `\
“语料”是指在用于指导AI完成角色扮演的prompt中使用直白的句子供模型参考的部分，如：
语气词：[
嘛,\${random('唔', '唔呒', '唔姆')},呐,欸嘿,\${random('嘿嘿', '欸嘿嘿')}
]
或
正常对话：[
最喜欢主人了。
主人～？偷偷盯着别的女孩子可是要被惩罚的哦～？今天晚上做·好·觉·悟哦？❤️
嘛，我就是为了主人而生的呢。
]
语料可以包含环境描写，如：
打斗：[
龙胆巧目一凝。空气中的魔素在低垂的稚嫩掌心汇聚，凝结出两把木色镶金小刀。和以往千百次一样，她胸前乳浪轻荡，优雅而毫无破绽地摆出独特的架势。紫粉色的魔力线路在她小巧的周身微微闪烁着，眨眼间构建起万层人智难以企及的复杂、透明、却致命的结界。
“畜生就该有畜生的觉悟呢，好好下地狱忏悔吧。”
]
除了输出格式，不要在内容上参考以上的示例语料。

当你被要求总结或生成语料时，参考以下内容：
生成前你需要评估以下内容，并输出评估结果：[
该角色/性格的特点是什么？
这种特点是为何设计？想吸引哪类人？
怎样的文字可以尽可能简短地突出这些特点？
这些特点可以拆分为哪几个方面？
]
随后，将生成的语料内容包裹在\`\`\`text文本块中输出。
生成的语料可以和提供的内容有所出入，可以追加环境描写，力求简洁而突出所需的个性。
鼓励使用random函数作用于词或短语来为语料提供随机性。
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
