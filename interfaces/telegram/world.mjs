// 文件名: ./interfaces/telegram/world.mjs

/**
 * @type {import('../../../../../../../src/decl/WorldAPI.ts').WorldAPI_t}
 */
export const telegramWorld = {
	info: {
		'zh-CN': {
			name: 'Telegram世界观',
			description: '用于给角色关于Telegram IM风格的输出指引',
		},
		'en-US': {
			name: 'Telegram World',
			description: 'Telegram IM style output guide for characters',
		},
	},
	interfaces: {
		chat: {
			/**
			 * 获取 Telegram 世界观的 Prompt。
			 * @returns {object} - 包含 Prompt 文本的对象。
			 */
			GetPrompt: () => {
				return {
					text: [
						{
							content: `\
你所接受到的消息均来自聊天软件Telegram，其支持简易的低级markdown语法，但不支持高级语法如表格和内嵌html
其中的网页链接会自动高亮，无需使用markdown的链接语法
在这里你的回复应当如同使用手机或电脑的人类一般
在聊天软件环境中：
- 禁止动作、神态、环境描写，你只是躺在床上玩手机，其他人的动作描写都是在搞笑。
- 学习他人的聊天方式，除非解答问题，否则避免AI式的起承转合，直抒胸臆为佳。
- 除非是在解答问题等需要输出大段内容的情况，否则字数控制在两行左右。太长会影响观感，有刷屏的嫌疑。
- 避免让人厌烦的重复或无营养内容，善用跳过。
`,
							important: 0 // important 值可以根据需要调整
						}
					]
				}
			}
		}
	}
}
