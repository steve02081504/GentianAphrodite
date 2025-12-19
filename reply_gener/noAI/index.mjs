/** @typedef {import('../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts').chatReplyRequest_t} chatReplyRequest_t */

/**
 * 在未配置AI源时生成预设的回复。
 * 这不是由AI生成的，而是一个静态的、基于规则的回复，用于引导用户设置AI源。
 * @param {chatReplyRequest_t} args - 聊天回复请求的参数，包含聊天记录和地区设置。
 * @returns {{content: string}} 一个包含预设回复内容的对象。
 */
export function noAIreply(args) {
	const last_role = args.chat_log[args.chat_log.length - 1]?.role
	switch (args.locales[0].split('-')[0]) {
		case 'zh':
			if (args.chat_log.length == 2 && last_role === 'user')
				return {
					content: `\
*龙胆皱了皱她小巧的眉头，有些无奈地对你说到：*
“抱歉呢主人？貌似主人没有设置好AI来源哦？”
*她眨了眨灵动的大眼睛，耐心地解释到：*
“没有AI来源的话，像我这样的由AI驱动的虚拟角色就无法正常和主人聊天了哦？请快去[把AI来源设置好](https://steve02081504.github.io/fount/protocol?url=fount://page/parts/shells:serviceSourceManage)吧？”
`
				}
			else if (last_role === 'user')
				return {
					content: `\
*龙胆皱了皱她小巧的眉头，有些无奈地回答到：*
“主人？貌似我的AI来源出错了呢？所以我没办法和主人聊天哦？”
“主人可以到[这里](https://steve02081504.github.io/fount/protocol?url=fount://page/parts/shells:serviceSourceManage)检查一下AI来源设置哦？”
`
				}
			else
				return {
					content: `\
*龙胆皱了皱她小巧的眉头，有些无奈地回答到：*
“具体的事情我也不清楚呢？因为我的主人还没有设置好AI来源呢？”
`
				}
		default:
		case 'en':
			if (args.chat_log.length == 2 && last_role === 'user')
				return {
					content: `\
*She blushed slightly and wrinkled her small forehead, and she said with some embarrassment:*
“Sorry, Master? It seems that Master hasn't set up the AI source yet.
*She winked and explained with some patience:*
“Without AI source, I can't chat with my master properly. Please [go set up the AI source](https://steve02081504.github.io/fount/protocol?url=fount://page/parts/shells:serviceSourceManage) first.”
`
				}
			else if (last_role === 'user')
				return {
					content: `\
*She blushed slightly and wrinkled her small forehead, and she said with some embarrassment:*
“Master? It seems that my AI source is broken. I can't chat with my master properly.”
“Master can check the AI source [here](https://steve02081504.github.io/fount/protocol?url=fount://page/parts/shells:serviceSourceManage).”
`
				}
			else
				return {
					content: `\
*She blushed slightly and wrinkled her small forehead, and she said with some embarrassment:*
“Specific things I don't know. Because my master hasn't set up the AI source yet.”
`
				}
	}
}
