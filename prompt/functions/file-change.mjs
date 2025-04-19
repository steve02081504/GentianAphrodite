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
		'文件', /<\/?(view|replace|override)-file/i, 'error', /Error/, /file:\/\//
	], 'any') || await match_keys(args, [
		'查看', '浏览', '替换', '修改', '新建', '创建', '写入', '文件', '读取', /\.[A-Za-z]{2,4}/
	], 'user') >= 2) {
		result += `\
无需shell命令，你可以进行更加原生的文件操作。通过返回以下格式来触发执行并获取结果：
- 使用 <view-file> 查看文件内容:
<view-file>
path1
path2
etc
</view-file>
如：
<view-file>
D:/tmp.mjs
</view-file>

- 使用 <replace-file> 替换文件内容：
<replace-file>
	<file path="文件路径">
		<replacement regex="false">
			<search>要查找的普通文本</search>
			<replace>要替换成的内容</replace>
		</replacement>
		<replacement regex="true">
			<search>/正则表达式/flags</search> <!-- JS风格的正则表达式字符串 -->
			<replace>要替换成的内容</replace>
		</replacement>
		<!-- 可以有多个 <replacement> -->
	</file>
	<!-- 可以有多个 <file> -->
</replace-file>

优先使用普通文本查找 (\`regex="false"\`)，只有在必要时才使用正则表达式 (\`regex="true"\`)。
当 \`regex="true"\` 时, \`<search>\` 标签内的文本应为JavaScript语法的正则表达式字符串（包含开头的 \`/\` 和结尾的 \`/flags\`）。
如，将所有数字替换为"数字":
<replace-file>
	<file path="D:/test.txt">
		<replacement regex="true">
			<search>/\\d+/g</search>
			<replace>数字</replace>
		</replacement>
	</file>
</replace-file>

系统会报告替换失败的操作，并返回替换后的整体文件内容。

- 使用 <override-file> 来创建新文件或完全覆盖已有文件内容:
<override-file path="文件路径">文件内容写在这里</override-file>
如：
<override-file path="D:/tmp.mjs">
const a = 1;
const b = 2;
</override-file>

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
