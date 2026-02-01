import { localhostLocales } from '../../../../../../../src/scripts/i18n.mjs'
import { loadAnyPreferredDefaultPart } from '../../../../../../../src/server/parts_loader.mjs'
import { username, GentianAphrodite } from '../../charbase.mjs'
import { GetReply } from '../../reply_gener/index.mjs'
import { newCharReply, newUserMessage } from '../../scripts/statistics.mjs'

import { recommend_command_plugin } from './recommend_command.mjs'
import { GetShellWorld } from './world.mjs'
/** @typedef {import('../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts').chatLogEntry_t} chatLogEntry_t */

/**
 * Shell 辅助功能的主入口函数。
 * 它接收来自终端环境的上下文信息，将其转换为聊天记录格式，
 * 然后调用核心回复生成逻辑来获取 AI 的建议（包括推荐的命令和解释性内容）。
 * @param {object} args - 包含 shell 上下文的对象。
 * @param {string} args.username - 当前用户名。
 * @param {string} args.UserCharname - 用户的角色名。
 * @param {string} args.shelltype - shell 的类型 (例如 'bash', 'powershell')。
 * @param {Array<object>} args.shellhistory - shell 的历史记录，包含命令和输出。
 * @param {string} args.pwd - 当前工作目录。
 * @param {string} args.screen - 当前屏幕内容。
 * @param {string} args.command_now - 用户当前正在输入的命令。
 * @param {string} args.command_output - 当前命令的 stdout。
 * @param {string} args.command_error - 当前命令的 stderr。
 * @param {string[]} args.rejected_commands - 用户已拒绝的推荐命令列表。
 * @param {object} args.chat_scoped_char_memory - 与当前聊天范围相关的角色记忆。
 * @returns {Promise<object>} - 一个包含 AI 回复的对象，包括推荐命令、解释内容和更新后的记忆。
 */
export async function shellAssistMain(args) {
	/** @type {chatLogEntry_t[]} */
	const chat_log = []
	for (const entry of args.shellhistory)
		if (entry.command)
			chat_log.push({
				role: 'system',
				name: args.shelltype || '终端',
				content: `\
用户执行了命令: \`${entry.command}\`

执行结果：
stdout: ${entry.output.includes('\n') ? '\n```\n' + entry.output + '\n```' : '`' + entry.output + '`'}
stderr: ${entry.error.includes('\n') ? '\n```\n' + entry.error + '\n```' : '`' + entry.error + '`'}
`,
				files: [],
				extension: entry.extension ??= {}
			})
		else
			chat_log.push({
				...entry,
				extension: entry.extension ??= {},
				files: [],
			})
	for (const entry of chat_log)
		if (entry.extension.recommend_command)
			entry.content = entry.content.trimEnd() + `\n<recommend-command>\n${entry.extension.recommend_command}\n</recommend-command>`

	let user_doing_now = ''
	if (args.screen) user_doing_now += `\
现在的屏幕内容：
\`\`\`
${args.screen}
\`\`\`
`
	user_doing_now += `\
用户现在执行的命令：\`${args.command_now}\`
所在路径：\`${args.pwd}\`
`
	if (args.command_output) user_doing_now += `\
输出内容：\`${args.command_output}\`
`
	if (args.command_error) user_doing_now += `\
错误信息：\`${args.command_error}\`
`
	if (args.rejected_commands.length) user_doing_now += `\
用户已拒绝的命令：\`${args.rejected_commands.join('`, `')}\`
`
	chat_log.push({
		role: 'system',
		name: args.shelltype || '终端',
		content: user_doing_now,
		files: [],
		extension: {}
	})
	const AIsuggestion = await GetReply({
		supported_functions: {
			markdown: false,
			mathjax: false,
			html: false,
			unsafe_html: false,
			files: false,
			add_message: false,
		},
		chat_name: 'shell-assist-' + new Date().getTime(),
		char_id: 'gentian',
		Charname: '龙胆',
		UserCharname: args.UserCharname,
		locales: localhostLocales,
		time: new Date(),
		world: GetShellWorld(args.shelltype),
		user: await loadAnyPreferredDefaultPart(username, 'personas'),
		char: GentianAphrodite,
		other_chars: [],
		plugins: {
			recommend_command: recommend_command_plugin
		},
		chat_scoped_char_memory: args.chat_scoped_char_memory,
		chat_log,
		extension: {
			source_purpose: 'shell-assist'
		}
	})
	newUserMessage(args.command_now, 'shell')
	if (AIsuggestion) newCharReply(AIsuggestion.content, 'shell')
	return {
		name: '龙胆',
		recommend_command: AIsuggestion?.recommend_command,
		content: AIsuggestion?.content,
		chat_scoped_char_memory: args.chat_scoped_char_memory,
		shellhistory: args.shellhistory,
		extension: AIsuggestion?.extension,
	}
}
