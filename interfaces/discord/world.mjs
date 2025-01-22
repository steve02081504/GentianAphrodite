/**
 * @type {import('../../../../../../../src/decl/WorldAPI.ts').WorldAPI_t}
 */
export let discordWorld = {
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
在聊天软件环境中一般来说不会有动作描写，且回复大部分情况下应当简洁清晰明了，你可以关注其他人的回复方式并在字数和语气上进行调整
`,
							important: 0
						}
					]
				}
			}
		}
	}
}
