import { Events, ChannelType } from 'npm:discord.js'
import { Buffer } from 'node:buffer'
import { base_match_keys, SimplifiyChinese, PreprocessChatLogEntry } from '../../scripts/match.mjs'
import { GetReply } from '../../reply_gener/index.mjs'
import GentianAphrodite from '../../main.mjs'
import { findMostFrequentElement, UTCToLocal } from '../../scripts/tools.mjs'
import { get_discord_silence_plugin } from './silence.mjs'
import { rude_words } from '../../scripts/dict.mjs'
import { getMessageFullContent, splitDiscordReply } from './tools.mjs'
import jieba from 'npm:nodejieba'
import { random } from '../../scripts/random.mjs'
import { discordWorld } from './world.mjs'
/** @typedef {import('../../../../../../../src/public/shells/chat/decl/chatLog.ts').chatLogEntry_t} chatLogEntry_t */
/**
 * @typedef {{
* 	ownerUserName: string
* 	OwnnerNameKeywords: string[]
* }} discord_config_t
*/

const MaxRetries = 3
async function tryFewTimes(func, times = MaxRetries) {
	while (times--)
		try { return await func() }
		catch (error) {
			await new Promise(resolve => setTimeout(resolve, 2000))
			if (times === 0) throw error
		}
}

/**
 * @param {Client} client
 * @param {discord_config_t} config
 */
export default async function DiscordBotMain(client, config) {
	const MAX_MESSAGE_DEPTH = config.maxMessageDepth || 20
	const MAX_FEACH_COUNT = config.maxFetchCount || Math.floor(MAX_MESSAGE_DEPTH * 3 / 2) || MAX_MESSAGE_DEPTH
	let lastSendMessageTime = {}
	let replayInfoCache = {}
	let userinfoCache = {}
	let FuyanMode = false

	let chat_scoped_char_memory = {}, in_hypnosis_channel_id = null
	/**
	 * @param {import('npm:discord.js').OmitPartialGroupDMChannel<Message<boolean>>} message
	 * @returns {Promise<chatLogEntry_t>}
	 */
	async function DiscordMessageToFountChatLogEntry(message) {
		let author = userinfoCache[message.author.id] || message.author
		if (!userinfoCache[message.author.id] || Math.random() < 0.25)
			message.author.fetch().then((user) => userinfoCache[message.author.id] = user).catch(_ => 0)
		let name = author.displayName || author.globalName
		if (!name) name = author.username
		else if (author.username == config.ownerUserName) name = author.username
		else name += name.toLowerCase() === author.username.toLowerCase() ? '' : ` (${author.username})`

		let content = getMessageFullContent(message)

		/** @type {chatLogEntry_t} */
		let result = {
			...replayInfoCache[message.id] || { extension: {} },
			timeStamp: UTCToLocal(message.createdTimestamp),
			role: author.username === config.ownerUserName ? 'user' : 'char',
			name,
			content,
			files: await Promise.all([...message.attachments.map(async (attachment) => {
				return {
					name: attachment.name,
					buffer: Buffer.from(await fetch(attachment.url).then((response) => response.arrayBuffer())),
					description: attachment.description,
					mimeType: attachment.contentType
				}
			}), ...message.embeds.map(embed => embed.image?.url).filter(url => url).map(async url => {
				return {
					name: url.split('/').pop(),
					buffer: Buffer.from(await fetch(url).then((response) => response.arrayBuffer())),
					description: '',
					mimeType: 'image/png'
				}
			})]),
			extension: {
				discord_messages: [message]
			}
		}
		return result
	}
	let Gentian_words = ['龙胆', 'gentian']
	let spec_words = [...config.OwnnerNameKeywords, ...rude_words, ...Gentian_words]
	function isBotCommand(content) {
		return content.match(/^[!$%&/\\！]/)
	}
	let ChannelMuteStartTimes = {}

	function isInFavor(channelID) {
		let lastSendTime = lastSendMessageTime[channelID] || 0
		let lastMessage = client.channels.cache.get(channelID).messages.cache.last() || { createdTimestamp: 0 }
		return new Date(lastMessage.createdTimestamp) - new Date(lastSendTime) < 3 * 60000 // 间隔 3 分钟内的对话
	}
	function isMuted(channelID) {
		return Date.now() - (ChannelMuteStartTimes[channelID] || 0) < 3 * 60000
	}
	/**
	 * @param {import('npm:discord.js').OmitPartialGroupDMChannel<Message<boolean>>} message
	 * @returns {boolean}
	 */
	function CheckMessageContentTrigger(message) {
		let content = getMessageFullContent(message)
		console.info({
			content: content,
			authorUserName: message.author.username,
			channelID: message.channel.id
		})

		if (message.channel.type == ChannelType.DM) {
			console.info('DM message')
			if (message.author.id != client.user.id && message.author.username != config.ownerUserName) return false
			else return true
		}
		else if (in_hypnosis_channel_id && message.author.username != config.ownerUserName) return false

		let possible = 0

		possible += base_match_keys(content, config.OwnnerNameKeywords) * 7 // 每个匹配对该消息追加 7% 可能性回复消息

		possible += base_match_keys(content, Gentian_words) * 5 // 每个匹配对该消息追加 5% 可能性回复消息

		possible += base_match_keys(content, [/(花|华)(萝|箩|罗)(蘑|磨|摩)/g]) * 3 // 每个匹配对该消息追加 3% 可能性回复消息

		let is_bot_command = isBotCommand(content) // 跳过疑似bot命令

		let inFavor = isInFavor(message.channel.id)
		let EngWords = content.split(' ')
		let mentionedWithoutAt = (base_match_keys(
			content.substring(0, 5) + ' ' + content.substring(content.length - 3), ['龙胆']
		) || base_match_keys(EngWords.slice(0, 6).concat(EngWords.slice(-3)).join(' '), ['gentian'])) &&
			!base_match_keys(content, [/(龙胆(有|能|这边|目前|[^ 。你，]{0,3}的)|gentian('s|is|are|can|has))/i]) &&
			!base_match_keys(content, [/^.{0,5}龙胆$/i])

		let inMute = isMuted(message.channel.id)

		if (message.author.username === config.ownerUserName) {
			if (mentionedWithoutAt || message.mentions.users.has(client.user.id)) {
				possible += 100
				delete ChannelMuteStartTimes[message.channel.id]
				inMute = false
			}
			if (inMute || (
				inFavor && base_match_keys(content, ['闭嘴', '安静', '肃静']) && content.length < 10
			)) {
				ChannelMuteStartTimes[message.channel.id] = Date.now()
				inMute = true
			}
		}

		if (message.author.username === config.ownerUserName) {
			if (base_match_keys(content, ['老婆', '女票', '女朋友', '炮友'])) possible += 50
			if (base_match_keys(content, [/(有点|好)紧张/, '救救', '帮帮', '帮我', '来人', '咋用', '教教', /是真的(吗|么)/])) possible += 100
			if (base_match_keys(content, ['龙胆']) && base_match_keys(content, [/怎么(想|看)/])) possible += 100
			if (base_match_keys(content, ['睡了', '眠了', '晚安', '睡觉去了'])) possible += 50
			if (base_match_keys(content, ['失眠了', '睡不着'])) possible += 100
			if (inFavor) {
				possible += 4
				if (base_match_keys(content, [
					/(再|多)(来|表演)(点|.*(次|个))/, '来个', '不够', '不如', '继续',
					/^(那|所以你|可以再|你?再(讲|说|试试)|你(觉得|想|知道))/, /^so/i,
				])) possible += 100
			}
			if (message.mentions.users.has(client.user.id)) possible += 100
			if (!is_bot_command) possible += 7 // 多出 7% 的可能性回复主人
		}
		else if (mentionedWithoutAt) {
			if (inFavor) possible += 90
			else possible += 40
			if (base_match_keys(content, [/[午安早晚]安/])) possible += 100
		}

		if (message.mentions.users.has(config.ownerUserName)) {
			possible += 7 // 多出 7% 的可能性回复提及主人的消息
			if (base_match_keys(content, rude_words)) if (FuyanMode) return false; else return true // 提及还骂人？你妈妈没了
		}
		if (message.mentions.users.has(client.user.id)) {
			possible += 40 // 多出 40% 的可能性回复提及自己的消息
			if (base_match_keys(content, [/\?|？/, '怎么', '什么', '吗', /(大|小)还是/, /(还是|哪个)(大|小)/])) possible += 100 // 疑问句保真
			if (base_match_keys(content, rude_words)) if (FuyanMode) return false; else possible += 100 // 提及还骂人？你妈妈没了
			if (base_match_keys(content, ['你主人', '你的主人'])) possible += 100
		}

		if (inMute) {
			console.info('in mute')
			return false
		}
		else
			delete ChannelMuteStartTimes[message.channel.id]

		let result = Math.random() < possible / 100
		console.info('CheckMessageContentTrigger', possible + '%', result)
		return result
	}

	let ChannelHandlers = {}
	let ChannelMessageQueues = {}
	/**
	 * @type {Record<string, chatLogEntry_t[]>}
	 */
	let ChannelChatLogs = {}
	/**
	 * @param {import('npm:discord.js').OmitPartialGroupDMChannel<Message<boolean>>} message
	 * @returns {(...args: any[]) => Promise<void>}
	 */
	function GetMessageSender(message) {
		let default_messagesender = async reply => await tryFewTimes(() => message.channel.send(reply))
		let messagesender = default_messagesender
		if (message.mentions?.users?.has?.(client.user.id))
			messagesender = async reply => {
				try { return await tryFewTimes(() => message.reply(reply)) }
				catch (error) { return await default_messagesender(reply) }
				finally { messagesender = default_messagesender }
			}
		return async (message) => {
			let result = await messagesender(message)
			if (!(Object(message) instanceof String)) replayInfoCache[result.id] = message
			return result
		}
	}
	let ErrorRecord = {}
	async function ErrorHandler(error, message) {
		let error_message = `${error.name}: ${error.message}\n\`\`\`${error.stack}\n\`\`\``
		if (ErrorRecord[error_message]) return
		else ErrorRecord[error_message] = true
		let AIsuggestion
		try {
			AIsuggestion = await GetReply({
				Charname: '龙胆',
				UserCharname: config.ownerUserName,
				locale: '',
				time: new Date(),
				world: discordWorld,
				user: null,
				char: GentianAphrodite,
				other_chars: [],
				plugins: [],
				chat_summary: '',
				chat_scoped_char_memory,
				chat_log: [{
					name: '龙胆',
					content: in_hypnosis_channel_id ? '请主人下达指令。' : '主人，有什么我可以帮到您的吗～？',
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
					content: in_hypnosis_channel_id ? '在回复时保持呆滞语气。' : '在回复问题时保持少女语气，适当添加语气词。',
					timeStamp: new Date(),
					role: 'system',
					extension: {}
				}],
			})
		} catch (another_error) {
			if (`${error.name}: ${error.message}` == `${another_error.name}: ${another_error.message}`)
				AIsuggestion = { content: in_hypnosis_channel_id ? '抱歉，洗脑母畜龙胆没有解决思路。' : '没什么解决思路呢？' }
			else
				AIsuggestion = { content: '```\n' + another_error.stack + '\n```\n' + (in_hypnosis_channel_id ? '抱歉，洗脑母畜龙胆没有解决思路。' : '没什么解决思路呢？') }
		}
		AIsuggestion = error_message + '\n' + AIsuggestion.content
		let randIPdict = {}
		AIsuggestion = AIsuggestion.replace(/(?:\d{1,3}\.){3}\d{1,3}/g, ip => randIPdict[ip] ??= Array(4).fill(0).map(() => Math.floor(Math.random() * 255)).join('.'))

		let messagesender = GetMessageSender(message)
		try {
			let splited_reply = splitDiscordReply(AIsuggestion)
			for (let message of splited_reply) await messagesender(message)
		} catch (error) {
			await messagesender(AIsuggestion)
		}
	}
	async function DoMessageReply(message) {
		let typeingInterval = setInterval(() => { try{ message.channel.sendTyping() }catch(e){} }, 5000)
		function clearTypeingInterval() {
			if (typeingInterval) clearInterval(typeingInterval)
			typeingInterval = null
		}

		try {
			if (message.author.username === config.ownerUserName)
				if (!in_hypnosis_channel_id && base_match_keys(message.content, [/^龙胆.*不敷衍点.{0,2}$/])) FuyanMode = false
				else if (!in_hypnosis_channel_id && base_match_keys(message.content, [/^龙胆.*敷衍点.{0,2}$/])) FuyanMode = true
				else if (base_match_keys(message.content, [/^龙胆.*自裁.{0,2}$/])) {
					await GetMessageSender(message)(in_hypnosis_channel_id ? '好的。' : '啊，咱死了～')
					client.destroy()
					return
				}
				else if (base_match_keys(message.content, [/^龙胆.{0,2}复诵.{0,2}`.*`$/])) {
					let content = message.content.match(/^龙胆.{0,2}复诵.{0,2}`(?<content>.*)`$/).groups.content
					return GetMessageSender(message)(content)
				}
				else if (!in_hypnosis_channel_id && base_match_keys(message.content, [/^(龙胆|[\n,.~、。呵哦啊嗯噫欸，～])*$/, /^龙胆龙胆(龙胆|[\n!,.?~、。呵哦啊嗯噫欸！，？～])+$/]))
					return GetMessageSender(message)(SimplifiyChinese(message.content).replaceAll('龙胆', '主人'))

			let reply = FuyanMode ? { content: '嗯嗯！' } :
				await GetReply({
					Charname: '龙胆',
					UserCharname: config.ownerUserName,
					ReplyToCharname: message.author.username,
					locale: '',
					time: new Date(),
					world: discordWorld,
					user: null,
					char: GentianAphrodite,
					other_chars: [],
					plugins: {
						discord_silence: get_discord_silence_plugin(message)
					},
					chat_summary: '',
					chat_scoped_char_memory,
					chat_log: ChannelChatLogs[message.channel.id],
				})

			if (chat_scoped_char_memory.in_hypnosis)
				in_hypnosis_channel_id = message.channel.id
			else in_hypnosis_channel_id = null

			if (reply.content || reply.files?.length) {
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
				return true
			}
			else
				console.info('no reply form AI, skipping reply')
		} catch (error) {
			ErrorHandler(error, message)
		} finally {
			clearTypeingInterval()
		}
	}
	function MargeChatLog(log) {
		let last, newlog = []
		for (let entry of log)
			if (
				last?.name == entry.name &&
				entry.timeStamp - last.timeStamp < 3 * 60000 &&
				last.files.length == 0
			) {
				last.content += '\n' + entry.content
				last.files = entry.files
				last.extension ??= {}
				last.extension.discord_messages ??= []
				last.extension.discord_messages = last.extension.discord_messages.concat(entry.extension.discord_messages)
			}
			else
				newlog.push(last = entry)
		return newlog
	}
	async function HandleMessageQueue(channelid) {
		let myQueue = ChannelMessageQueues[channelid]
		try {
			if (!ChannelChatLogs[channelid]) {
				ChannelChatLogs[channelid] ??= MargeChatLog(
					await Promise.all(
						(await myQueue[0].channel.messages.fetch({ limit: MAX_FEACH_COUNT }))
							.map(DiscordMessageToFountChatLogEntry).reverse()
					)
				)
				while (ChannelChatLogs[channelid].length > MAX_MESSAGE_DEPTH) ChannelChatLogs[channelid].shift()
				let lastTrigger = myQueue.reverse().find(CheckMessageContentTrigger)
				if (lastTrigger) await DoMessageReply(lastTrigger)
				ChannelMessageQueues[channelid] = []
				return
			}
			let chatlog = ChannelChatLogs[channelid]

			while (myQueue?.length) {
				/** @type {import('npm:discord.js').OmitPartialGroupDMChannel<Message<boolean>>} */
				let message = myQueue.shift()

				{
					let newlog = await DiscordMessageToFountChatLogEntry(message)
					let last = chatlog[chatlog.length - 1]

					if (
						last?.name == newlog.name &&
						newlog.timeStamp - last.timeStamp < 3 * 60000 &&
						last.files.length == 0
					) {
						last.content += '\n' + newlog.content
						last.files = newlog.files
						last.extension ??= {}
						last.extension.discord_messages ??= []
						last.extension.discord_messages = last.extension.discord_messages.concat(newlog.extension.discord_messages)
						if (Object.keys(last.extension || {}).length) last.extension = {
							discord_messages: last.extension.discord_messages
						}
					}
					else {
						chatlog.push(newlog)
						while (chatlog.length > MAX_MESSAGE_DEPTH) chatlog.shift()
					}
				}
				// skip if message author is this bot
				if (message.author.id === client.user.id) continue
				if (CheckMessageContentTrigger(message))
					await DoMessageReply(message)
				else if (!in_hypnosis_channel_id && message.author.id != client.user.id) {
					// 若消息记录的后10条中有5条以上的消息内容相同
					// 则直接使用相同内容的消息作为回复
					let repet = findMostFrequentElement(chatlog.slice(-10).map(message => message.content).filter(content => content))
					if (
						repet.count >= 4 &&
						!base_match_keys(repet.element, spec_words) &&
						!isBotCommand(repet.element) &&
						message.author.id != client.user.id &&
						!chatlog.some((message) => message.name == client.user.username && message.content == repet.element)
					) {
						console.info('复读！', repet.element)
						GetMessageSender(message)(repet.element)
					}
					if (!base_match_keys(message.content, [...spec_words, '你的'])) {
						// 若消息内容包含"是啥"、"是什么"
						const whatis_words = ['是啥', '是什么']
						if (base_match_keys(message.content, whatis_words)) {
							const part = message.content.replace(/["'‘“]/g, '').split(/[ !,.?。！，：？]/).find(split => base_match_keys(split, whatis_words))
							let startIndex = part.length
							let endIndex = 0

							jieba.extract(part, 5).map(e => e.word).forEach(word => {
								startIndex = Math.min(startIndex, part.indexOf(word))
								endIndex = Math.max(endIndex, part.lastIndexOf(word) + word.length)
							})

							const mainwords_str = part.slice(startIndex, endIndex)

							if (mainwords_str)
								GetMessageSender(message)(
									`${random('这个', '')}咱${random('知道', '会哦', '晓得', '懂呢')}，${mainwords_str}${random('是', '就是')}${mainwords_str}${random('！', '～')}`
								)
						}
					}
				}
			}
			// if in favor or has user message, map all chat log entries except last
			if ((isInFavor(channelid) || chatlog.some(entry => entry.role == 'user')) && !isMuted(channelid))
				await Promise.all(chatlog.slice(0, -1).map(PreprocessChatLogEntry))
		}
		catch (error) {
			ErrorHandler(error, myQueue[0])
		}
		finally {
			delete ChannelHandlers[channelid]
		}
	}
	client.on(Events.MessageCreate, async (message) => {
		try {
			try {
				await tryFewTimes(async () => message = await message.fetch())
			}
			catch (error) {
				if (error.name == 'DiscordAPIError' && error.code == 10008) return // message deleted
			}
			if (message.channel.type == ChannelType.DM)
				if (message.author.id != client.user.id && message.author.username != config.ownerUserName) return
			(ChannelMessageQueues[message.channel.id] ??= []).push(message)
			if (!in_hypnosis_channel_id || message.channel.id == in_hypnosis_channel_id)
				ChannelHandlers[message.channel.id] ??= HandleMessageQueue(message.channel.id)
		} catch (error) {
			ErrorHandler(error, message)
		}
	})
	client.on(Events.MessageUpdate, async (message) => {
		if (message.author.id === client.user.id) return
		let chatlog = ChannelChatLogs[message.channel.id] || []
		// 我们先检查下这个消息是否在消息记录中，若不在直接跳过
		if (!chatlog.find(logentry => logentry.extension?.discord_messages?.find(id => id == message.id))) return
		let Update = chatlog.find(logentry => logentry.extension?.discord_messages?.find(id => id == message.id))
		if (Update) {
			let newlog = MargeChatLog(await Promise.all(Update.extension.discord_messages.map(DiscordMessageToFountChatLogEntry)))[0]
			for (let key in newlog) Update[key] = newlog[key]
			for (let key in Update) if (!(key in newlog)) delete Update[key]
			Update.content += '\n（已编辑）'
			return
		}
	})
	console.info('bot ' + client.user.username + ' ready!')
}
