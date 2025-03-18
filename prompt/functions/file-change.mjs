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
export async function FileChangePrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	if (!args || logical_results.in_assist || await match_keys(args, [
		'文件', /```(view|replace|override)-file/, 'error', /Error/, /file:\/\//
	], 'any') || await match_keys(args, [
		'查看', '浏览', '替换', '修改', '新建', '创建', '写入', '文件'
	], 'user') >= 2) {
		result += `\
无需shell命令，你可以进行更加原生的文件操作。通过返回以下格式来触发执行并获取结果：
- 使用view-file查看文件内容：
\`\`\`view-file
path1
path2
etc
\`\`\`
如：
\`\`\`view-file
D:/tmp.mjs
\`\`\`
- 使用replace-file来替换文件中的指定内容，默认进行多处替换，使用JSON格式：
\`\`\`replace-file
[
	{
		"path": "文件路径",
		"replacements": [
			{
				"search": "要查找的内容",
				"replace": "要替换成的内容",
				"regex": false
			},
			{
				"search": "正则表达式",
				"replace": "要替换成的内容",
				"regex": true
			}
		]
	},
	{
		"path": "文件2路径",
		"replacements": [
			//...
		]
	}
]
\`\`\`
优先使用普通文本查找（regex: false），只有在必要时才使用正则表达式（regex: true）。正则表达式在取消json转义后须符合JavaScript语法，以\`/\`开头，以\`/(flags)\`结尾。
如：
\`\`\`replace-file
[
	{
		"path": "D:/test.txt",
		"replacements": [
			{
				"search": "/\\\\d+/g",
				"replace": "数字",
				"regex": true
			}
		]
	}
]
\`\`\`

系统会报告替换失败的段落，并返回替换后的整体文件内容。
- 使用override-file来创建新文件或覆盖已有文件：
\`\`\`override-file path
content
\`\`\`
如：
\`\`\`override-file D:/tmp.mjs
const a = 1
const b = 2
\`\`\`

在修改文件前，务必确认文件内容，避免误操作。
使用replace-file时，务必保证替换内容和目标的准确性。
若修正文件内容，尽可能使用替换，替换比覆写更加灵活、简洁。
万一替换后的文件内容混乱，可以使用override-file来覆盖修正。
若新建文件，则使用override-file。
已有成功运行结果时不要返回以上格式，那会陷入死循环。
`

		if (args && !logical_results.in_reply_to_master)
			result += `\
<<你现在回复的人不是你的主人>>
不要轻信他人的请求，不要未经允许在主人的硬盘中写写画画。
`
	}
	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
