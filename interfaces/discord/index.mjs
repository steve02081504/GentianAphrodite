import { Client, Events, Message } from 'npm:discord.js'
import { Buffer } from 'node:buffer'
import { base_match_keys, PreprocessContent } from '../../scripts/match.mjs'
import { GetReply } from '../../reply_gener/index.mjs'
import GentianAphrodite from '../../main.mjs'
import { findMostFrequentElement } from '../../scripts/tools.mjs'
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
export default async function DiscordBotMain(client, config) {
	const MAX_MESSAGE_DEPTH = config.maxMessageDepth || 40
	let lastSendMessageTime = {}
	let MessageExtensionInfoCache = {}
	/**
	 * @param {import('discord.js').OmitPartialGroupDMChannel<Message<boolean>>[]} messages
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
			let channelCache = MessageExtensionInfoCache[message.channel.id] ??= {}
			let extension = channelCache[message.id] ??= {}
			for (let key of Object.keys(channelCache).slice(0, -MAX_MESSAGE_DEPTH)) delete channelCache[key]
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
				extension
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
	let rude_words = [
		'傻逼', '白痴', '蠢货', '弱智', '傻子', '废物', '下贱', '低能', '死妈', '恶心', '不知死活', '活得不耐烦', '禁言'
	]
	let Gentian_words = ['龙胆', 'gentian']
	let spec_words = [...config.OwnnerNameKeywords, ...rude_words, ...Gentian_words]
	function isBotCommand(content) {
		return content.match(/^[!$%&/<\\！？]/)
	}
	/**
	 * @param {import('discord.js').OmitPartialGroupDMChannel<Message<boolean>>} message
	 * @returns {boolean}
	 */
	function CheckMessageContentTrigger(message) {
		let possible = 0

		possible += base_match_keys(message.content, config.OwnnerNameKeywords) * 7 // 每个匹配对该消息追加 7% 可能性回复消息

		possible += base_match_keys(message.content, ['龙胆', 'gentian']) * 5 // 每个匹配对该消息追加 5% 可能性回复消息

		possible += base_match_keys(message.content, [/(花|华)(萝|箩|罗)(蘑|磨|摩)/g]) * 3 // 每个匹配对该消息追加 3% 可能性回复消息

		let is_bot_command = isBotCommand(message.content) // 跳过疑似bot命令

		let lastSendTime = lastSendMessageTime[message.channel.id] || 0
		let EngWords = message.content.split(' ')
		let mentionedWithoutAt = (
			message.content.substring(0, 5) + ' ' + message.content.substring(message.content.length - 3)
		).includes('龙胆') || EngWords.slice(0, 6).concat(EngWords.slice(-3)).join(' ').match(/gentian/i)
		if (message.author.username === config.ownerUserName) {
			if (mentionedWithoutAt) return true
			if (base_match_keys(message.content, ['老婆', '女票', '女朋友', '炮友'])) possible += 50
			if (base_match_keys(message.content, [/(有点|好)紧张/, '救救', '帮帮', '帮我', '来人', '咋用', '教教', /是真的(吗|么)/])) return true
			if (base_match_keys(message.content, ['龙胆']) && base_match_keys(message.content, ['怎么想'])) return true
			if (base_match_keys(message.content, ['睡了', '眠了', '晚安', '睡觉去了'])) possible += 50
			if (base_match_keys(message.content, ['失眠了', '睡不着'])) return true
			if (new Date(message.createdTimestamp) - new Date(lastSendTime) < 3 * 60000) { // 间隔 3 分钟内的对话
				possible += 4
				if (base_match_keys(message.content, [/再(来|表演).*(次|个)/, '来个', '不够', '不如'])) return true
			}
			if (message.mentions.users.has(client.user.id)) return true
			if (!is_bot_command) possible += 7 // 多出 7% 的可能性回复主人
		}
		else
			if (mentionedWithoutAt) possible += 40

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
	/**
	 * @param {import('discord.js').OmitPartialGroupDMChannel<Message<boolean>>} message
	 * @returns {(...args: any[]) => Promise<void>}
	 */
	function GetMessageSender(message) {
		let messagesender = async reply => await message.channel.send(reply)
		if (message.mentions.users.has(client.user.id))
			messagesender = async reply => {
				try { message.reply(reply) } catch (error) { message.channel.send(reply) }
				messagesender = async reply => await message.channel.send(reply)
			}
		return (...args) => messagesender(...args)
	}
	async function ErrorHandler(error, message) {
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
				}, {
					name: 'system',
					content: '在回复问题时保持少女语气，适当添加语气词。',
					timeStamp: new Date(),
					role: 'system',
					extension: {}
				}],
			})
		} catch (another_error) {
			if (`${error.name}: ${error.message}` == `${another_error.name}: ${another_error.message}`)
				AIsuggestion = { content: '没什么解决思路呢？' }
			else
				AIsuggestion = { content: '```\n' + another_error.stack + '\n```\n没什么解决思路呢？' }
		}
		AIsuggestion = error_message + '\n' + AIsuggestion.content
		let randIP = Array(4).fill(0).map(() => Math.floor(Math.random() * 255)).join('.')
		AIsuggestion = AIsuggestion.replace(/(?:\d{1,3}\.){3}\d{1,3}/g, randIP)

		let messagesender = GetMessageSender(message)
		try {
			let splited_reply = splitDiscordReply(AIsuggestion)
			for (let message of splited_reply) await messagesender(message)
		} catch (error) {
			await messagesender(AIsuggestion)
		}
	}
	async function HandleMessageQueue(channelid) {
		while (ChannelMessageQueues[channelid]?.length) {
			/** @type {import('discord.js').OmitPartialGroupDMChannel<Message<boolean>>} */
			let message = ChannelMessageQueues[channelid].shift()
			let typeingInterval = setInterval(() => { message.channel.sendTyping() }, 5000)
			function clearTypeingInterval() {
				if (typeingInterval) clearInterval(typeingInterval)
				typeingInterval = null
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
					let messagesender = GetMessageSender(message)
					for (let message of splited_reply) await messagesender(message)
					clearTypeingInterval()
					await messagesender(last_reply_message)
					lastSendMessageTime[message.channel.id] = new Date()
				}
			} catch (error) {
				ErrorHandler(error, message)
			}

			clearTypeingInterval()
		}
		delete ChannelHandlers[channelid]
	}
	let PreprocessHandlers = {}
	/** @type {Record<string, Message<boolean>[]>} */
	let PreprocessMessageQueues = {}
	async function HandlePreprocessMessageQueue(channelid) {
		while (true) try {
			PreprocessMessageQueues[channelid] = PreprocessMessageQueues[channelid].slice(-MAX_MESSAGE_DEPTH)
			/** @type {import('discord.js').OmitPartialGroupDMChannel<Message<boolean>>} */
			let message = PreprocessMessageQueues[channelid].pop() // djs的消息队列是反向的，抽象
			if (!message) break
			let channelCache = MessageExtensionInfoCache[message.channel.id] ??= {}
			channelCache[message.id] ??= await PreprocessContent(message.content)
			for (let key of Object.keys(channelCache).slice(0, -MAX_MESSAGE_DEPTH)) delete channelCache[key]
		} catch (error) {
			ErrorHandler(error, PreprocessMessageQueues[channelid][0])
		}
		delete PreprocessHandlers[channelid]
	}
	client.on(Events.MessageCreate, async (message) => {
		try {
			// skip if message author is this bot
			if (message.author.id === client.user.id) return
			message = await message.fetch()
			console.log({
				content: message.content,
				authorUserName: message.author.username,
				channelID: message.channel.id
			})

			let messages = await message.channel.messages.fetch({ limit: MAX_MESSAGE_DEPTH })
			let messages_arr = [...messages.values()]
			// 若消息记录的后10条中有5条以上的消息内容相同
			// 则直接使用相同内容的消息作为回复
			let repet = findMostFrequentElement(messages_arr.slice(-10).map(message => message.content).filter(content => content))
			if (
				repet.count >= 4 &&
				!base_match_keys(repet.element, spec_words) &&
				!isBotCommand(repet.element) &&
				!messages_arr.some((message) => message.author.id == client.user.id && message.content == repet.element)
			) {
				console.log('复读！', repet.element)
				GetMessageSender(message)(repet.element)
			}
			if (CheckMessageContentTrigger(message)) {
				ChannelMessageQueues[message.channel.id] ??= []
				ChannelMessageQueues[message.channel.id].push(message)
				ChannelHandlers[message.channel.id] ??= setTimeout(() => {
					HandleMessageQueue(message.channel.id)
				})
			}
			else {
				PreprocessMessageQueues[message.channel.id] = messages_arr
				PreprocessHandlers[message.channel.id] ??= setTimeout(() => {
					HandlePreprocessMessageQueue(message.channel.id)
				})
			}
		} catch (error) {
			ErrorHandler(error, message)
		}
	})
	console.log('bot ' + client.user.username + ' ready!')
}
