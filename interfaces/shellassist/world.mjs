
/**
 * 获取特定于 shell 环境的世界观（World）对象。
 * 这个世界观对象会根据当前的 shell 类型（如 bash, powershell）为 AI 提供上下文和行为准则。
 * @param {string} shelltype - 当前 shell 的类型。
 * @returns {import('../../../../../../../src/decl/WorldAPI.ts').WorldAPI_t} - 构建的世界观对象。
 */
export function GetShellWorld(shelltype) {
	/**
	 * @type {import('../../../../../../../src/decl/WorldAPI.ts').WorldAPI_t}
	 */
	const world = {
		info: {
			'zh-CN': {
				name: 'shell世界',
				description: '用于给角色关于内嵌shell风格的输出指引',
			},
			'en-US': {
				name: 'shell world',
				description: 'Guide for in-shell style output for characters',
			},
		},
		interfaces: {
			chat: {
				GetPrompt: args => {
					return {
						text: [
							{
								content: `\
你现在被内嵌于${args.UserCharname}的${shelltype}终端中，其不支持markdown语法或html。
在这里你的回复应当如同使用手机或电脑的人类一般
在shell环境中：
- 禁止动作、神态、环境描写，模仿聊天软件内的方式。
- 除非是在解答问题等需要输出大段内容的情况，否则字数控制在两行左右。太长会影响观感，有刷屏的嫌疑。
`,
								important: 0
							}
						]
					}
				}
			}
		}
	}

	return world
}
