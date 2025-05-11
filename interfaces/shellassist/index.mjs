import { GetReply } from '../../reply_gener/index.mjs'
import GentianAphrodite from '../../main.mjs'
import { GetShellWorld } from './world.mjs'
import { recommend_command_plugin } from './recommend_command.mjs'
import { localhostLocales } from '../../../../../../../src/scripts/i18n.mjs'
import { newCharReplay, newUserMessage } from '../../scripts/statistics.mjs'
/** @typedef {import('../../../../../../../src/public/shells/chat/decl/chatLog.ts').chatLogEntry_t} chatLogEntry_t */

/**
 * @type {(data: {
 * 	username: string
 * 	UserCharname: string
 * 	shelltype: string
 * 	shellhistory: ({
 * 		command: string
 * 		output: string
 * 		error: string
 * 		time: timeStamp_t
 * 	} | {
 * 		role: role_t
 * 		content: string
 * 	})[]
 *  pwd: string
 * 	command_now: string
 * 	command_error: string
 * 	rejected_commands: string[]
 * 	chat_scoped_char_memory: {}
 * }) => Promise<{
 * 	name: string
 * 	avatar: string
 * 	recommend_command: string
 * 	content: string
 * 	chat_scoped_char_memory: {}
 * }>}
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
			entry.content = entry.content.trimEnd() + `\n\`\`\`recommend_command\n${entry.extension.recommend_command}\n\`\`\``

	let user_doing_now = `\
用户现在执行的命令：\`${args.command_now}\`
所在路径：\`${args.pwd}\`
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
		user: null,
		char: GentianAphrodite,
		other_chars: [],
		plugins: {
			recommend_command: recommend_command_plugin
		},
		chat_summary: '',
		chat_scoped_char_memory: args.chat_scoped_char_memory,
		chat_log
	})
	newUserMessage(args.command_now, 'shell')
	newCharReplay(AIsuggestion.content, 'shell')
	return {
		name: '龙胆',
		recommend_command: AIsuggestion.recommend_command,
		content: AIsuggestion.content,
		chat_scoped_char_memory: args.chat_scoped_char_memory,
		shellhistory: args.shellhistory,
		extension: AIsuggestion.extension,
	}
}
