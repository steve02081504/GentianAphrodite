/**
 * @type {import('../../../../../../../src/decl/pluginAPI.ts').pluginAPI_t}
 */
export const recommend_command_plugin = {
	info: {
		'zh-CN': {
			name: 'shell推荐命令插件',
			description: '推荐命令插件，让AI能够在shell环境中推荐命令',
			author: 'steve02081504',
		},
		'en-US': {
			name: 'shell recommend command plugin',
			description: 'recommend command plugin, let AI recommend commands in shell environment',
			author: 'steve02081504',
		},
	},
	interfaces: {
		chat: {
			/**
			 * 获取推荐命令的 Prompt。
			 * @param {object} args - 参数对象，包含 UserCharname。
			 * @param {object} result - 结果对象。
			 * @returns {object} - 包含 additional_chat_log 的对象。
			 */
			GetPrompt: async (args, result) => {
				return {
					additional_chat_log: [
						{
							role: 'system',
							name: 'system',
							content: `\
你可以通过回复以下格式来推荐命令让${args.UserCharname}选择是否执行：
<recommend_command>
command_body
</recommend_command>
`,
						}
					]
				}
			},
			/**
			 * 处理回复，提取推荐命令。
			 * @param {object} result - 结果对象。
			 * @returns {boolean} - 返回 false 表示此处理器只修改结果，不完全处理回复。
			 */
			ReplyHandler: async result => {
				const match = result.content.match(/<recommend_command>(?<command>[\S\s]*?)<\/recommend_command>/)
				const command = match?.groups?.command?.trim() // Extract and trim the command

				if (command) {
					result.extension.recommend_command = result.recommend_command = command
					result.content = result.content.replace(/\s*<recommend_command>[\S\s]*?<\/recommend_command>\s*/g, '\n').trim() // Also trim result
				}

				// Return false as this handler only modifies the result, doesn't fully handle the reply
				return false
			}
		}
	}
}
