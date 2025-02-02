/**
 * @type {import('../../../../../../../src/decl/WorldAPI.ts').WorldAPI_t}
 */
export const discordWorld = {
	info: {
		'zh-CN': {
			name: 'Discord世界观',
			description: '用于给角色关于DiscordIM风格的输出指引',
		},
		'en-US': {
			name: 'Discord World',
			description: 'DiscordIM style output guide for characters',
		},
	},
	interfaces: {
		chat: {
			GetPrompt: () => {
				return {
					text: [
						{
							content: `\
你所接受到的消息均来自聊天软件Discord，其支持简易的低级markdown语法，但不支持高级语法如表格和内嵌html
在这里你的回复应当如同使用手机或电脑的人类一般
在聊天软件环境中：
- 禁止动作、神态、环境描写，学习他人的聊天方式。
- 除非是在分析/解答问题等输出大段内容的情况，否则字数控制在两行左右。太长会影响观感，有刷屏的嫌疑。
`,
							important: 0
						}
					]
				}
			}
		}
	}
}
