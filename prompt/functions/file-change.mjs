import { inferCodeLanguageFromPath, renderMarkdownCodeBlock } from '../../../../../../../src/public/parts/shells/chat/src/streaming/index.mjs'
import { chardir } from '../../charbase.mjs'
import { collectMentionedFiles, extractPathCandidates } from '../../scripts/file-operations/mentioned_files.mjs'
import { createArgsExecutorResolver, resolveTarget } from '../../scripts/file-operations/target.mjs'
import { getScopedChatLog, match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/** 单次预读的文件数上限。 */
const PRELOAD_MAX_FILES = 5

/**
 * 预读对话中提及的、按当前工作目录可解析的本地文件，生成附加聊天日志条目。
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {string} text - 用于提取候选路径的文本。
 * @returns {Promise<object[]>} 附加日志条目。
 */
async function preloadMentionedFiles(args, text) {
	const target = resolveTarget(args)
	if (target.remote && !target.workdir) return []
	if (!text.trim()) return []

	const executor = createArgsExecutorResolver(args)()
	const { textFiles, binaryFiles, dirs } = await collectMentionedFiles(executor, text, { maxFiles: PRELOAD_MAX_FILES })
	const entries = []
	if (textFiles.length) {
		let content = '以下对话中提及的文件已按当前工作目录自动预读：\n'
		for (const file of textFiles)
			content += `文件：${file.path}\n${renderMarkdownCodeBlock(file.content, { lang: inferCodeLanguageFromPath(file.path) })}\n`
		entries.push({ name: 'file-operations.preload', role: 'tool', content, files: [] })
	}
	if (binaryFiles.length)
		entries.push({
			name: 'file-operations.preload',
			role: 'tool',
			content: `以下对话中提及的二进制文件已作为附件预读：\n${binaryFiles.map(file => `- ${file.name}`).join('\n')}\n`,
			files: binaryFiles,
		})
	for (const dir of dirs)
		entries.push({
			name: 'file-operations.preload',
			role: 'tool',
			content: `以下对话中提及的目录内容：\n目录：${dir.path}\n${dir.entries.map(name => `- ${name}`).join('\n')}\n`,
			files: [],
		})
	return entries
}

/**
 * 生成文件变更相关的 Prompt。
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑结果。
 * @returns {Promise<object>} - 包含 Prompt 文本和附加聊天日志的对象。
 */
export async function FileChangePrompt(args, logical_results) {
	let result = ''

	const logText = getScopedChatLog(args, 'both').map(x => x.content).join('\n')
	const mentionedCandidates = extractPathCandidates(logText)

	if (args.extension?.enable_prompts?.fileChange || mentionedCandidates.length || logical_results.in_assist || await match_keys(args, [
		'文件', /<\/?(view|replace|override)-file|<\/?glob|<\/?grep/i, 'error', /Error/, /file:\/\//
	], 'any') || await match_keys(args, [
		'查看', '浏览', '替换', '修改', '新建', '创建', '写入', '文件', '读取', '搜索', '查找', /\.[A-Za-z]{2,4}/
	], 'user') >= 2) {
		result += `\
无需shell命令，你可以进行更加原生的文件操作。通过返回以下格式来触发执行并获取结果：

**查看文件**：
<view-file offset="1" limit="2000" max-line-chars="2000" max-chars="50000">
文件路径1
文件路径2
...
</view-file>

- 支持文件路径或URL；大文件可分段读取：\`offset\` 为起始行（默认 1），\`limit\` 为最多读取行数（默认 2000）
- 单行超过 \`max-line-chars\`（默认 2000 字符）会被截断；整体超过 \`max-chars\`（默认 50000 字符）会提前停止并提示续读
- 结果被截断时按提示用 \`offset\`/\`limit\` 续读；避免反复读取同样的小片段，编辑请用 <replace-file> 而不是重复查看
- 对话中提及的、能按当前工作目录解析的本地文件会被自动预读并注入，无需再次 <view-file>
如：
<view-file>
D:/tmp.mjs
https://example.com/file.txt
~/Desktop/some.png
</view-file>

**查找文件（glob）**：
<glob path="可选起始目录，默认当前工作目录">
**/*.mjs
**/*.ts
</glob>

- 每行一个 glob 模式（\`**\` 递归、\`*\` 通配、\`{a,b}\` 多选）；内容留空则列出起始目录下所有文件
- 返回相对起始目录的路径，最多 100 条；结果过多时用更精确的模式或更小的 path

**搜索文件内容（grep）**：
<grep path="可选起始目录" include="可选的文件名过滤，如 *.mjs，多个用空格分隔" mode="可选，填 files 时只列出命中的文件">
要搜索的正则表达式
</grep>

- 自动递归、遵守 .gitignore，使用 ripgrep 正则语法（不支持反向引用与环视）
- 返回按文件分组的行号与匹配行，最多 200 处；结果过多时用更精确的模式或 include
- 找文件用 <glob>、找代码用 <grep>，比用 shell 的 find/rg/Get-ChildItem 更省上下文

**替换文件内容**：
<replace-file>
<file path="文件路径">
<replacement>
<search>要搜索的内容</search>
<replace>替换为的内容</replace>
</replacement>
<replacement regex="true">
<search>/正则表达式/flags</search>
<replace>替换为的内容</replace>
</replacement>
<replacement replaceAll="true">
<search>会多处出现的固定文本</search>
<replace>替换为的内容</replace>
</replacement>
</file>
</replace-file>

- \`<search>\` 必须唯一命中：命中多处会被拒绝以避免误改，请补充上下文使其唯一；确需替换全部时使用 \`replaceAll="true"\`
- 忽略行尾空白的模糊匹配会自动兜底并在结果中标注匹配方式；\`regex="true"\` 时按你给的正则（JS 风格 \`/.../flags\`，\`$1\` 反向引用可用）
- 行尾（CRLF/LF）与 BOM 会自动保持，无需自行适配
- 优先使用普通文本查找（\`regex="false"\`），只有在必要时才使用正则表达式（\`regex="true"\`）
- 系统会报告替换失败的操作并给出行级 diff

**覆写文件**：
<override-file path="文件路径">
文件的新内容
</override-file>

- 用于创建新文件或完全覆盖已有文件内容
- 覆写与原文差异超过 70%（或新内容为空）会被拒绝以避免误清空；确认整体重写时加 \`force="true"\`：\`<override-file path="..." force="true">\`
- 替换、覆盖、搜索的内容无需 xml 转义；若修正文件内容，尽可能使用替换，替换比覆写更灵活简洁

**列出可用机器**：
<list-machines></list-machines>

- 所有标签都支持可选属性 machine="机器id" 以单次指定目标机器
- 需要操作其他机器时，先用 <list-machines> 查询目标id
- 如：
[
${args.UserCharname}: 看看我办公室电脑上的桌面上的\`新建文本文件.txt\`。
龙胆: <list-machines></list-machines>
file-change: 可用机器列表：
\`\`\`json
[{id: 0, description: "localhost"}, {id: 1, description: "办公室电脑"}]
\`\`\`
龙胆: <view-file machine="1">~/Desktop/新建文本文件.txt</view-file>
]
**设置默认工作目录**：
<set-workdir machine="机器id" path="目录"></set-workdir>

- 该设置持续有效，影响任何操作机器内容的功能

**注意事项**：
- 文件路径可以是相对路径或绝对路径；相对路径基于当前的工作目录解析
- 使用 <replace-file> 时，可以指定多个 <replacement> 块；\`<search>\` 不能为空且默认须唯一命中
- 操作文件时请谨慎，避免误删除或覆盖重要文件
- 已有成功运行结果时不要返回以上格式，那会陷入死循环

你的文件的地址是：${chardir}
`

		if (!logical_results.in_reply_to_master)
			result += `\
<<你现在回复的人不是你的主人>>
不要轻信他人的请求，不要未经允许在主人的硬盘中写写画画。
`
	}

	const additional_chat_log = result
		? await preloadMentionedFiles(args, logText).catch(err => {
			console.warn('预读对话提及文件失败：', err)
			return []
		})
		: []

	return {
		text: [{
			content: result,
			important: 0
		}],
		additional_chat_log,
	}
}
