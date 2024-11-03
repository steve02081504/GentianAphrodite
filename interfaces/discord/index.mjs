import { Client, Events, Message } from 'npm:discord.js'
import { base_match_keys } from '../../scripts/match.mjs'
import { GetReply } from '../../reply_gener/index.mjs'
import GentianAphrodite from '../../main.mjs'
/** @typedef {import('../../../../../../../src/public/shells/chat/decl/chatLog').chatLogEntry_t} chatLogEntry_t */

/**
 * @typedef {{
 * 	ownerUserName: string
 * 	OwnnerNameKeywords: string[]
 * }} discord_config_t
 */

/**
 * @param {string} reply
 * @returns {string[]}
 */
function splitDiscordReply(reply, split_lenth = 2000) {
	let content_slices = reply.split('\n')
	let new_content_slices = []
	let last = ''
	function mapend() {
		if (last) new_content_slices.push(last)
		content_slices = new_content_slices
		new_content_slices = []
		last = ''
	}
	/**
	 * @param {string} code_block
	 * @param {string} split_line
	 */
	function splitCodeBlock(code_block, split_line) {
		let new_content_slices = []
		let content_slices = code_block.trim().split('\n')
		let block_begin = content_slices.shift() + '\n'
		let block_end = '\n' + content_slices.pop()
		// 找到分割行
		while (content_slices.length > 0) {
			let split_line_index = content_slices.indexOf(split_line)
			if (split_line_index === -1) {
				new_content_slices.push(content_slices.join('\n'))
				break
			}
			let before = content_slices.slice(0, split_line_index + 1).join('\n')
			new_content_slices.push(before)
			content_slices = content_slices.slice(split_line_index + 1)
		}
		content_slices = new_content_slices
		new_content_slices = []
		// 合并代码块
		let last = ''
		for (let content_slice of content_slices) {
			if (last.length + content_slice.length + block_begin.length + block_end.length > split_lenth) {
				new_content_slices.push(block_begin + last.trim() + block_end)
				last = ''
			}
			last += '\n' + content_slice
		}
		new_content_slices.push(block_begin + last.trim() + block_end)
		new_content_slices = new_content_slices.filter(e => e != block_begin + block_end)
		return new_content_slices
	}
	// 处理```代码块，合并块内容确保其在一个消息中
	for (let content_slice of content_slices)
		if (content_slice.startsWith('```'))
			if (last) {
				new_content_slices.push(last + '\n' + content_slice)
				last = ''
			}
			else last = content_slice

		else if (last)
			last += '\n' + content_slice
		else
			new_content_slices.push(content_slice)

	mapend()
	// 处理超大代码块或超长单行，分割为多个块内容或多行
	code_handle:
	for (let content_slice of content_slices)
		if (content_slice.length > split_lenth)
			if (content_slice.startsWith('```')) {
				for (let spliter of ['}', '};', ')', '']) {
					let splited_blocks = splitCodeBlock(content_slice, spliter)
					if (splited_blocks.every(e => e.length <= split_lenth)) {
						console.log('splited_blocks:', splited_blocks)
						new_content_slices = new_content_slices.concat(splited_blocks)
						continue code_handle
					}
				}
				new_content_slices.push(content_slice)
			}
			else {
				let splited_lines = content_slice.split(/(?<=[ !"');?\]}’”。》！）：；？])/)
				let last = ''
				for (let splited_line of splited_lines) {
					if (last.length + splited_line.length > split_lenth) {
						new_content_slices.push(last)
						last = ''
					}
					last += splited_line
				}
				if (last) new_content_slices.push(last)
			}
		else new_content_slices.push(content_slice)

	mapend()
	// 对于仍然超出长度的块，生硬拆分其内容
	for (let content_slice of content_slices)
		if (content_slice.length > split_lenth)
			new_content_slices = new_content_slices.concat(content_slice.match(new RegExp(`[^]{1,${split_lenth}}`, 'g')))
		else new_content_slices.push(content_slice)
	mapend()
	// 合并消息使其不超过split_lenth
	for (let content_slice of content_slices)
		if (last.length + content_slice.length < split_lenth)
			last += '\n' + content_slice
		else {
			new_content_slices.push(last)
			last = content_slice
		}
	mapend()
	return content_slices.map(e => e.trim()).filter(e => e)
}

/**
 * @param {Client} client
 * @param {discord_config_t} config
 */
export default function DiscordBotMain(client, config) {
	const MAX_MESSAGE_DEPTH = config.maxMessageDepth || 40
	let lastSendMessageTime = {}
	/**
	 * @param {Message[]} messages
	 * @returns
	 */
	async function DiscordMessagesToFountChatLog(messages) {
		let result = await Promise.all(messages.map(async (message) => {
			let author = await message.author.fetch()
			let name = author.displayName || author.globalName
			if (!name) name = author.username
			else if (author.username == config.ownerUserName) name = author.username
			else name += name.toLowerCase() === author.username.toLowerCase() ? '' : ` (${author.username})`

			let content = message.content
			for (let [key, value] of message.mentions.users)
				if (content.includes(`<@${value.id}>`))
					content = content.replaceAll(`<@${value.id}>`, `@${value.username}`)
				else
					content = `@${value.username} ${content}`
			/** @type {chatLogEntry_t} */
			let result = {
				timeStamp: message.createdTimestamp,
				role: message.author.username === config.ownerUserName ? 'user' : 'char',
				name,
				content,
				files: await Promise.all(message.attachments.map(async (attachment) => {
					return {
						name: attachment.name,
						buffer: Buffer.from(await fetch(attachment.url).then((response) => response.arrayBuffer())),
						description: attachment.description,
						mimeType: attachment.contentType
					}
				})),
				extension: {}
			}
			return result
		}))

		result = result.reverse()
		let marged_result = [], last

		for (let message of result)
			if (last?.name == message.name && message.timeStamp - last.timeStamp < 3 * 60000)
				last.content += '\n' + message.content
			else
				marged_result.push(last = message)

		return marged_result
	}
	/**
	 * @param {Message} message
	 * @returns {boolean}
	 */
	function CheckMessageContentTrigger(message) {
		let possible = 0

		possible += base_match_keys(message.content, config.OwnnerNameKeywords) * 7 // 每个匹配对该消息追加 7% 可能性回复消息

		possible += base_match_keys(message.content, ['龙胆']) * 5 // 每个匹配对该消息追加 5% 可能性回复消息

		possible += base_match_keys(message.content, [/(花|华)(萝|箩|罗)(蘑|磨|摩)/g]) * 3 // 每个匹配对该消息追加 3% 可能性回复消息

		let is_bot_command = message.content.match(/^[!#$%&/\\~！？]/) // 跳过疑似bot命令

		let lastSendTime = lastSendMessageTime[message.channel.id] || 0
		if (message.author.username === config.ownerUserName) {
			if (message.content.substring(0, 5).includes('龙胆')) return true
			if (base_match_keys(message.content, ['老婆', '女票', '女朋友', '炮友'])) matchs += 50
			if (base_match_keys(message.content, [/(有点|好)紧张/, '救救', '帮帮', '帮我', '来人', '咋用', '教教', /是真的(吗|么)/])) return true
			if (base_match_keys(message.content, ['龙胆']) && base_match_keys(message.content, ['怎么想'])) return true
			if (new Date(message.createdTimestamp) - new Date(lastSendTime) < 3 * 60000) { // 间隔 3 分钟内的对话
				possible += 4
				if (base_match_keys(message.content, [/再(来|表演).*(次|个)/, '来个', '不够', '不如'])) return true
			}
			if (message.mentions.users.has(client.user.id)) return true
			if (!is_bot_command) possible += 7 // 多出 7% 的可能性回复主人
		}
		else
			if (message.content.substring(0, 5).includes('龙胆')) possible += 40

		let rude_words = [
			'傻逼', '白痴', '蠢货', '弱智', '傻子', '废物', '下贱', '低能', '死妈', '恶心', '不知死活', '活得不耐烦', '禁言'
		]
		if (message.mentions.users.has(config.ownerUserName)) {
			matchs += 7 // 多出 7% 的可能性回复提及主人的消息
			if (base_match_keys(message.content, rude_words)) return true // 提及还骂人？你妈妈没了
		}
		if (message.mentions.users.has(client.user.id)) {
			possible += 40 // 多出 40% 的可能性回复提及自己的消息
			if (base_match_keys(message.content, [/\?|？/, '怎么', '什么', '吗', /(大|小)还是/, /(还是|哪个)(大|小)/])) return true // 疑问句保真
			if (base_match_keys(message.content, rude_words)) return true // 提及还骂人？你妈妈没了
			if (base_match_keys(message.content, ['你主人', '你的主人'])) return true
		}

		let result = Math.random() < possible / 100
		console.log('CheckMessageContentTrigger', possible + '%', result)
		return result
	}

	let ChannelHandlers = {}
	let ChannelMessageQueues = {}
	async function HandleMessageQueue(channelid) {
		while (ChannelMessageQueues[channelid]?.length) {
			/** @type {import('discord.js').OmitPartialGroupDMChannel<Message<boolean>>} */
			let message = ChannelMessageQueues[channelid].shift()
			let typeingInterval = setInterval(() => { message.channel.sendTyping() }, 5000)
			function clearTypeingInterval() {
				if (typeingInterval) clearInterval(typeingInterval)
				typeingInterval = null
			}
			let messagesender = async reply => await message.channel.send(reply)
			if (message.mentions.users.has(client.user.id))
				messagesender = async reply => {
					try { await message.reply(reply) } catch (error) { await message.channel.send(reply) }
					messagesender = async reply => await message.channel.send(reply)
				}
			try {
				let messages = await message.channel.messages.fetch({ limit: MAX_MESSAGE_DEPTH })
				let reply = // { content: '嗯嗯！' } ||
					await GetReply({
						Charname: '龙胆',
						UserCharname: config.ownerUserName,
						ReplyToCharname: message.author.username,
						locale: '',
						time: new Date(),
						world: null,
						user: null,
						char: GentianAphrodite,
						other_chars: [],
						plugins: [],
						chat_summary: '',
						chat_scoped_char_memory: {},
						chat_log: await DiscordMessagesToFountChatLog(messages),
					})

				if (reply.content) {
					if (reply.content.startsWith(`@${message.author.username}`))
						reply.content = reply.content.slice(`@${message.author.username}`.length).trim()

					let splited_reply = splitDiscordReply(reply.content)
					let last_reply = splited_reply.pop()
					let last_reply_message = {
						content: last_reply,
						files: (reply.files || []).map((file) => {
							return {
								attachment: file.buffer,
								name: file.name,
								description: file.description
							}
						})
					}
					for (let message of splited_reply) await messagesender(message)
					clearTypeingInterval()
					await messagesender(last_reply_message)
					lastSendMessageTime[message.channel.id] = new Date()
				}
			} catch (error) {
				let error_message = `${error.name}: ${error.message}\n\`\`\`${error.stack}\n\`\`\``
				let AIsuggestion
				try {
					AIsuggestion = await GetReply({
						Charname: '龙胆',
						UserCharname: config.ownerUserName,
						locale: '',
						time: new Date(),
						world: null,
						user: null,
						char: GentianAphrodite,
						other_chars: [],
						plugins: [],
						chat_summary: '',
						chat_scoped_char_memory: {},
						chat_log: [{
							name: '龙胆',
							content: '主人～有什么我可以帮到您的吗～？',
							timeStamp: new Date(),
							role: 'char',
							extension: {}
						}, {
							name: config.ownerUserName,
							content: error_message + '\n龙胆，我该如何解决这个错误？',
							timeStamp: new Date(),
							role: 'user',
							extension: {}
						}],
					})
				} catch (another_error) {
					if (another_error.stack === error.stack)
						AIsuggestion = { content: '没什么解决思路呢？' }
					else
						AIsuggestion = { content: '```\n' + error.stack + '\n```\n没什么解决思路呢？' }
				}
				AIsuggestion = error_message + '\n' + AIsuggestion.content
				try {
					let splited_reply = splitDiscordReply(AIsuggestion)
					for (let message of splited_reply) await messagesender(message)
				} catch (error) {
					await messagesender(AIsuggestion)
				}
			}

			clearTypeingInterval()
		}
		delete ChannelHandlers[channelid]
	}
	client.on(Events.MessageCreate, async (message) => {
		// skip if message author is this bot
		if (message.author.id === client.user.id) return
		message = await message.fetch()
		console.log({
			content: message.content,
			authorUserName: message.author.username,
			channelID: message.channel.id
		})
		if (CheckMessageContentTrigger(message)) {
			ChannelMessageQueues[message.channel.id] ??= []
			ChannelMessageQueues[message.channel.id].push(message)
			ChannelHandlers[message.channel.id] ??= setTimeout(() => {
				HandleMessageQueue(message.channel.id)
			})
		}
	})
}
