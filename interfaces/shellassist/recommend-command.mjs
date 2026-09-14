import { defineReplyHandler } from '../../../../../../../src/public/parts/shells/chat/src/reply/defineReplyHandler.mjs'
import { defineReplyPreviews } from '../../../../../../../src/public/parts/shells/chat/src/streaming/index.mjs'

/**
 * `<recommend-command>`：提取推荐命令到 extension 并从正文移除标签。
 * @type {import('../../../../../../../src/decl/pluginAPI.ts').ReplyHandler_t}
 */
export const recommendCommandReplyHandler = defineReplyHandler({
	tag: 'recommend-command',
	/**
	 * 提取推荐命令。
	 * @param {object} reply 回复对象
	 * @param {object} args 请求上下文
	 * @param {object} call 调用
	 * @returns {Promise<object>} 结果
	 */
	handle: async (reply, args, call) => {
		const command = call.body.trim()
		if (!command) return {}
		reply.extension.recommend_command = reply.recommend_command = command
		return { content: reply.content.replace(call.raw, '\n').trim() }
	},
})

/**
 * 推荐命令插件API类型定义
 * @type {import('../../../../../../../src/decl/pluginAPI.ts').pluginAPI_t}
 */
export const recommendCommandPlugin = {
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
							uid: 'system',
							content: `\
你可以通过回复以下格式来推荐命令让${args.UserCharname}选择是否执行：
<recommend-command>
command_body
</recommend-command>
`,
						}
					]
				}
			},
			ReplyHandler: recommendCommandReplyHandler,
			GetReplyPreviewUpdater: defineReplyPreviews([recommendCommandReplyHandler]),
		}
	}
}
