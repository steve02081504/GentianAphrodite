import { Events, ChannelType } from 'npm:discord.js'
import { Buffer } from 'node:buffer'
import { base_match_keys, SimplifiyChinese, PreprocessChatLogEntry } from '../../scripts/match.mjs'
import { GetReply } from '../../reply_gener/index.mjs'
import GentianAphrodite from '../../main.mjs'
import { escapeRegExp, findMostFrequentElement } from '../../scripts/tools.mjs'
import { get_discord_silence_plugin } from './silence.mjs'
import { rude_words } from '../../scripts/dict.mjs'
import { getMessageFullContent, splitDiscordReply } from './tools.mjs'
import { discordWorld } from './world.mjs'
import { tryFewTimes } from '../../scripts/tryFewTimes.mjs'
import { localhostLocales } from '../../../../../../../src/scripts/i18n.mjs'
import { mimetypeFromBufferAndName } from '../../scripts/mimetype.mjs'
/** @typedef {import('../../../../../../../src/public/shells/chat/decl/chatLog.ts').chatLogEntry_t} chatLogEntry_t */
/** @typedef {import('npm:discord.js').Message} Message */
/**
 * @typedef {{
* 	OwnerUserName: string
* 	OwnerNameKeywords: string[]
* }} discord_config_t
*/

export function GetBotConfigTemplate() {
	return {
		OwnerUserName: 'your_discord_username',
		OwnerNameKeywords: ['your_name_keyword1', 'your_name_keyword2'],
	}
}

/**
 * @param {Client} client
 * @param {discord_config_t} config
 */
export async function DiscordBotMain(client, config) {
	const MAX_MESSAGE_DEPTH = config.maxMessageDepth || 20
	const MAX_FEACH_COUNT = config.maxFetchCount || Math.floor(MAX_MESSAGE_DEPTH * 3 / 2) || MAX_MESSAGE_DEPTH
	const lastSendMessageTime = {}
	const replayInfoCache = {}
	const userinfoCache = {}
	const userNameMap = {
		name2id: {
			[client.user.username.replace(/gentian/ig, '龙胆')]: client.user.id
		},
		id2name: {
			[client.user.id]: client.user.username + ' (咱自己)'
		},
	}
	let FuyanMode = false, in_hypnosis_channel_id = null

	const chat_scoped_char_memory = {}
	/**
	 * @param {import('npm:discord.js').OmitPartialGroupDMChannel<Message<boolean>>} message
	 * @returns {Promise<chatLogEntry_t>}
	 */
	async function DiscordMessageToFountChatLogEntry(message) {
		const author = userinfoCache[message.author.id] || message.author
		if (!userinfoCache[message.author.id] || Math.random() < 0.25)
			message.author.fetch().then((user) => userinfoCache[message.author.id] = user).catch(_ => 0)
		let name = author.displayName || author.globalName
		if (!name) name = author.username
		else if (author.username == config.OwnerUserName) name = author.username
		else name += name.toLowerCase() === author.username.toLowerCase() ? '' : ` (${author.username})`

		{
			let index = 0; const originalName = name
			while ((userNameMap.name2id[name.replace(/gentian/ig, '龙胆')] ??= message.author.id) != message.author.id)
				name = `${originalName} (${++index}号同名)`
			userNameMap.id2name[message.author.id] = name
		}

		const content = await getMessageFullContent(message, client)

		/** @type {chatLogEntry_t} */
		const result = {
			...replayInfoCache[message.id] || { extension: {} },
			timeStamp: message.createdTimestamp,
			role: author.username === config.OwnerUserName ? 'user' : 'char',
			name,
			content,
			files: (await Promise.all([...[
				message.attachments,
				...message.messageSnapshots.map(referencedMessage => referencedMessage.attachments)
			].flatMap(x => x.map(x => x)).filter(Boolean).map(async (attachment) => {
				if (!attachment.url) return console.error('attachment has no url:', attachment)
				try {
					const buffer = Buffer.from(await tryFewTimes(
						() => fetch(attachment.url).then((response) => response.arrayBuffer())
					))
					return {
						name: attachment.name,
						buffer,
						description: attachment.description,
						mimeType: attachment.contentType || await mimetypeFromBufferAndName(buffer, attachment.name)
					}
				}
				catch (error) {
					console.error(error)
				}
			}), ...message.embeds.map(embed => embed.image?.url).filter(url => url).map(async url => {
				try {
					return {
						name: url.split('/').pop(),
						buffer: Buffer.from(await tryFewTimes(
							() => fetch(url).then((response) => response.arrayBuffer())
						)),
						description: '',
						mimeType: 'image/png'
					}
				}
				catch (error) {
					console.error(error)
				}
			})])).filter(Boolean),
			extension: {
				discord_messages: [message]
			}
		}
		return result
	}
	const Gentian_words = ['龙胆', 'gentian']
	const spec_words = [...config.OwnerNameKeywords, ...rude_words, ...Gentian_words]
	function isBotCommand(content) {
		return content.match(/^[!$%&/\\！]/)
	}
	const ChannelMuteStartTimes = {}

	function isInFavor(channelID) {
		const lastSendTime = lastSendMessageTime[channelID] || 0
		const lastMessage = client.channels.cache.get(channelID).messages.cache.last() || { createdTimestamp: 0 }
		return new Date(lastMessage.createdTimestamp) - new Date(lastSendTime) < 3 * 60000 // 间隔 3 分钟内的对话
	}
	function isMuted(channelID) {
		return Date.now() - (ChannelMuteStartTimes[channelID] || 0) < 3 * 60000
	}
	/**
	 * @param {import('npm:discord.js').OmitPartialGroupDMChannel<Message<boolean>>} message
	 * @returns {Promise<boolean>}
	 */
	async function CheckMessageContentTrigger(message, env) {
		const content = (await getMessageFullContent(message, client)).replace(/^(@\S+\s+)+/g, '')
		console.info({
			content,
			authorUserName: message.author.username,
			channelID: message.channel.id,
			has_other_gentian_bot: env.has_other_gentian_bot
		})

		if (message.channel.type == ChannelType.DM) {
			console.info('DM message')
			if (message.author.id != client.user.id && message.author.username != config.OwnerUserName) return false
			else return true
		}
		else if (in_hypnosis_channel_id && message.author.username != config.OwnerUserName) return false

		let possible = 0

		possible += base_match_keys(content, config.OwnerNameKeywords) * 7 // 每个匹配对该消息追加 7% 可能性回复消息

		possible += base_match_keys(content, Gentian_words) * 5 // 每个匹配对该消息追加 5% 可能性回复消息

		possible += base_match_keys(content, [/(花|华)(萝|箩|罗)(蘑|磨|摩)/g]) * 3 // 每个匹配对该消息追加 3% 可能性回复消息

		const is_bot_command = isBotCommand(content) // 跳过疑似bot命令

		const inFavor = isInFavor(message.channel.id)
		const EngWords = content.split(' ')
		const mentionedWithoutAt = !env.has_other_gentian_bot && (
			(base_match_keys(
				content.substring(0, 5) + ' ' + content.substring(content.length - 3), ['龙胆']
			) || base_match_keys(EngWords.slice(0, 6).concat(EngWords.slice(-3)).join(' '), ['gentian'])) &&
				!base_match_keys(content, [/(龙胆(有|能|这边|目前|[^ 。你，]{0,3}的)|gentian('s|is|are|can|has))/i]) &&
				!base_match_keys(content, [/^.{0,5}龙胆$/i]
			)
		)

		let inMute = isMuted(message.channel.id)

		if (message.author.username === config.OwnerUserName) {
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

		if (message.author.username === config.OwnerUserName) {
			if (base_match_keys(content, ['老婆', '女票', '女朋友', '炮友'])) possible += 50
			if (base_match_keys(content, [/(有点|好)紧张/, '救救', '帮帮', /帮(我|(你|你家)?(主人|老公|丈夫|爸爸|宝宝))/, '来人', '咋用', '教教', /是真的(吗|么)/])) possible += 100
			if (base_match_keys(content, ['龙胆']) && base_match_keys(content, [/怎么(想|看)/])) possible += 100
			if (base_match_keys(content, ['睡了', '眠了', '晚安', '睡觉去了'])) possible += 50
			if (base_match_keys(content, ['失眠了', '睡不着'])) possible += 100
			if (inFavor) {
				possible += 4
				if (base_match_keys(content, [
					/(再|多)(来|表演)(点|.*(次|个))/, '来个', '不够', '不如', '继续', '确认', '执行',
					/^(那|所以你|可以再|你?再(讲|说|试试)|你(觉得|想|知道|确定)|但是)/, /^so/i,
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

		if (message.mentions.users.some(user => user.username === config.OwnerUserName) || base_match_keys(content, config.OwnerNameKeywords)) {
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

		const result = Math.random() < possible / 100
		console.info('CheckMessageContentTrigger', possible + '%', result)
		return result
	}

	const ChannelHandlers = {}
	const ChannelMessageQueues = {}
	/**
	 * @type {Record<string, chatLogEntry_t[]>}
	 */
	const ChannelChatLogs = {}
	/**
	 * @param {import('npm:discord.js').OmitPartialGroupDMChannel<Message<boolean>>} message
	 * @returns {(...args: any[]) => Promise<void>}
	 */
	function GetMessageSender(message) {
		const default_messagesender = async reply => await tryFewTimes(() => message.channel.send(reply))
		let messagesender = default_messagesender
		if (message.mentions?.users?.has?.(client.user.id) && ChannelMessageQueues[message.channel.id].length)
			messagesender = async reply => {
				// Check for actual mentions like <@id>
				if ((reply.content || reply)?.match?.(/<@\d+>/))
					return await default_messagesender(reply)
				try { return await tryFewTimes(() => message.reply(reply)) }
				catch (error) { return await default_messagesender(reply) }
				finally { messagesender = default_messagesender }
			}
		return async (message) => {
			const result = await messagesender(message)
			if (!(Object(message) instanceof String)) replayInfoCache[result.id] = message
			return result
		}
	}
	const ErrorRecord = {}
	async function ErrorHandler(error, message) {
		const error_message = `\`\`\`\n${error.stack}\n\`\`\``
		if (ErrorRecord[error_message]) return
		else ErrorRecord[error_message] = true
		let AIsuggestion
		try {
			AIsuggestion = await GetReply({
				supported_functions: {
					markdown: true,
					mathjax: true,
					html: false,
					unsafe_html: false,
					files: true,
					add_message: false,
				},
				Charname: userNameMap.id2name[client.user.id],
				UserCharname: config.OwnerUserName,
				locales: localhostLocales,
				time: new Date(),
				world: discordWorld,
				user: null,
				char: GentianAphrodite,
				other_chars: [],
				plugins: [],
				chat_summary: '',
				chat_scoped_char_memory,
				chat_log: [{
					name: userNameMap.id2name[client.user.id],
					content: in_hypnosis_channel_id ? '请主人下达指令。' : '主人，有什么我可以帮到您的吗～？',
					timeStamp: new Date(),
					role: 'char',
					extension: {}
				}, {
					name: config.OwnerUserName,
					content: error_message + `
龙胆，我该如何解决这个错误？可以的话你来直接修复它。
注意的点：
- 以修正出问题的文件为主，宏观上没什么好修复的
- fount项目基于deno，没有package.json
- 不要删除整个项目并重新下载，那会删除你自己和我的用户配置
- 不能修复也没问题，帮我分析下报错也可以，不会怪你
`,
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
		const randIPdict = {}
		AIsuggestion = AIsuggestion.replace(/(?:\d{1,3}\.){3}\d{1,3}/g, ip => randIPdict[ip] ??= Array(4).fill(0).map(() => Math.floor(Math.random() * 255)).join('.'))

		const messagesender = GetMessageSender(message)
		try {
			const splited_reply = splitDiscordReply(AIsuggestion)
			for (const message of splited_reply) await messagesender(message)
		} catch (error) {
			await messagesender(AIsuggestion)
		}
	}
	const BannedStrings = []
	/**
	 * @param {import('npm:discord.js').OmitPartialGroupDMChannel<Message<boolean>>} message
	 * @returns {Promise<void>}
	 */
	async function DoMessageReply(message) {
		let typeingInterval = setInterval(() => { message.channel.sendTyping().catch(e => 0) }, 5000)
		function clearTypeingInterval() {
			if (typeingInterval) clearInterval(typeingInterval)
			typeingInterval = null
		}

		try {
			const replyHandler = async (reply) => {
				if (chat_scoped_char_memory.in_hypnosis)
					in_hypnosis_channel_id = message.channel.id
				else in_hypnosis_channel_id = null

				if (reply?.content || reply?.files?.length) {
					const members = message.channel?.members
					if (members && reply.content.includes('@')) {
						const nameToIdMap = new Map()
						let sortedNames = []
						members.map(member => {
							nameToIdMap.set(member.user.username, member.user.id)
							sortedNames.push(member.user.username)
							nameToIdMap.set(member.displayName, member.user.id)
							sortedNames.push(member.displayName)
						})
						sortedNames = [...new Set(sortedNames)].sort((a, b) => b.length - a.length)

						if (sortedNames.length > 0) {
							const mentionRegex = new RegExp(`@(${sortedNames.map(escapeRegExp).join('|')})(?!\\w)`, 'g')
							reply.content = reply.content.replace(mentionRegex, (match, matchedName) => {
								const userId = nameToIdMap.get(matchedName)
								return userId ? `<@${userId}>` : match
							})
						}
					}

					const splited_reply = splitDiscordReply(reply.content)
					const last_reply = splited_reply.pop()
					const last_reply_message = {
						content: last_reply,
						files: (reply.files || []).map((file) => {
							return {
								attachment: file.buffer,
								name: file.name,
								description: file.description
							}
						})
					}
					const messagesender = GetMessageSender(message)
					for (const message of splited_reply) await messagesender(message)
					await messagesender(last_reply_message)
					lastSendMessageTime[message.channel.id] = new Date()
					return true
				}
				else
					console.info('no reply form AI, skipping reply')
			}
			/**
			 *
			 * @returns {import('../../../../../../../src/public/shells/chat/decl/chatLog.ts').chatReplyRequest_t}
			 */
			const replayQuestGener = () => ({
				supported_functions: {
					markdown: true,
					mathjax: true,
					html: false,
					unsafe_html: false,
					files: true,
					add_message: true,
				},
				Charname: userNameMap.id2name[client.user.id],
				UserCharname: config.OwnerUserName,
				ReplyToCharname: message.author.username,
				locales: localhostLocales,
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
				Update: replayQuestGener,
				AddChatLogEntry: replyHandler,
				extension: {}
			})
			const reply = FuyanMode ? { content: '嗯嗯！' } : await GetReply(replayQuestGener())

			for (const BannedString of BannedStrings)
				reply.content = reply.content.replaceAll(BannedString, '')

			await replyHandler(reply)
		} catch (error) {
			ErrorHandler(error, message)
		} finally {
			clearTypeingInterval()
		}
	}
	function MargeChatLog(log) {
		const newlog = []
		let last
		for (const entry of log)
			if (
				last?.name == entry.name &&
				entry.timeStamp - last.timeStamp < 3 * 60000 &&
				last.files.length == 0
			) {
				last.content += '\n' + entry.content
				last.files = entry.files
				last.extension ??= {}
				last.extension.discord_messages = last.extension.discord_messages.concat(entry.extension.discord_messages)
			}
			else
				newlog.push(last = entry)
		return newlog
	}
	async function HandleMessageQueue(channelid) {
		const myQueue = ChannelMessageQueues[channelid]
		try {
			if (!ChannelChatLogs[channelid]) {
				const chatlog = ChannelChatLogs[channelid] ??= MargeChatLog(
					await Promise.all(
						(await myQueue[0].channel.messages.fetch({ limit: MAX_FEACH_COUNT }))
							.map(DiscordMessageToFountChatLogEntry).reverse()
					)
				)
				while (chatlog.length > MAX_MESSAGE_DEPTH) chatlog.shift()
				const has_other_gentian_bot = (() => {
					const text = chatlog.filter(message => ((Date.now() - message.timeStamp) < 5 * 60 * 1000) && message.extension.discord_messages[0]?.author.id != client.user.id).map(message => message.content).join('\n')
					return text.includes('龙胆') && text.match(/主人/g)?.length > 1
				})()
				let lastTrigger
				for (const message of myQueue.reverse())
					if (await CheckMessageContentTrigger(message, { has_other_gentian_bot })) {
						lastTrigger = message
						break
					}
				if (lastTrigger) await DoMessageReply(lastTrigger)
				ChannelMessageQueues[channelid] = []
				return
			}
			/**
			 * @type {(
			 * 	chatLogEntry_t & {
			 *	extension: {discord_messages: (import('npm:discord.js').OmitPartialGroupDMChannel<Message<boolean>>[])}
			 * })[]}
			 */
			const chatlog = ChannelChatLogs[channelid]

			while (myQueue?.length) {
				/** @type {import('npm:discord.js').OmitPartialGroupDMChannel<Message<boolean>>} */
				const message = myQueue.shift()

				{
					const newlog = await DiscordMessageToFountChatLogEntry(message)
					const last = chatlog[chatlog.length - 1]

					if (
						last?.name == newlog.name &&
						(newlog.timeStamp - last.timeStamp < 3 * 60000) &&
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

				if (message.author.username === config.OwnerUserName)
					if (!in_hypnosis_channel_id && base_match_keys(message.content, [/^龙胆.*不敷衍点.{0,2}$/])) FuyanMode = false
					else if (!in_hypnosis_channel_id && base_match_keys(message.content, [/^龙胆.*敷衍点.{0,2}$/])) FuyanMode = true
					else if (base_match_keys(message.content, [/^龙胆.*自裁.{0,2}$/])) {
						await GetMessageSender(message)(in_hypnosis_channel_id ? '好的。' : '啊，咱死了～')
						client.destroy()
						return
					}
					else if (base_match_keys(message.content, [/^龙胆.{0,2}复诵.{0,2}`.*`$/])) {
						const { content } = message.content.match(/^龙胆.{0,2}复诵.{0,2}`(?<content>.*)`$/).groups
						return GetMessageSender(message)(content)
					}
					else if (base_match_keys(message.content, [/^龙胆.{0,2}禁止.{0,2}`.*`$/])) {
						const { content } = message.content.match(/^龙胆.{0,2}禁止.{0,2}`(?<content>.*)`$/).groups
						BannedStrings.push(content)
					}
					else if (!in_hypnosis_channel_id && base_match_keys(message.content, [/^(龙胆|[\n,.~、。呵哦啊嗯噫欸，～])+$/, /^龙胆龙胆(龙胆|[\n!,.?~、。呵哦啊嗯噫欸！，？～])+$/]))
						return GetMessageSender(message)(SimplifiyChinese(message.content).replaceAll('龙胆', '主人'))

				const has_other_gentian_bot = (() => {
					const text = chatlog.filter(message => ((Date.now() - message.timeStamp) < 5 * 60 * 1000) && message.extension.discord_messages[0]?.author.id != client.user.id).map(message => message.content).join('\n')
					return text.includes('龙胆') && text.match(/主人/g)?.length > 1
				})()
				// skip if message author is this bot
				if (message.author.id === client.user.id) continue
				// 若最近7条消息都是bot和owner的消息，跳过激活检查，每个owner的消息都会触发
				if (chatlog.slice(-7).every(message => message.role == 'user' || message.name == client.user.username))
					await DoMessageReply(message)
				else if (await CheckMessageContentTrigger(message, {
					has_other_gentian_bot,
				}))
					await DoMessageReply(message)
				else if (!in_hypnosis_channel_id && message.author.id != client.user.id) {
					// 若消息记录的后10条中有5条以上的消息内容相同
					// 则直接使用相同内容的消息作为回复
					const repet = findMostFrequentElement(chatlog.slice(-10), message => message.content + '\n\n' + message.files.map(file => file.buffer.toString('hex')).join('\n'))
					if (
						repet.element.content &&
						repet.count >= 4 &&
						!base_match_keys(repet.element.content, spec_words) &&
						!isBotCommand(repet.element.content) &&
						message.author.id != client.user.id &&
						!chatlog.some((message) => message.name == client.user.username && message.content == repet.element.content)
					) {
						console.info('复读！', repet.element.content)
						GetMessageSender(message)({
							content: repet.element.content,
							files: (repet.element.files || []).map(file => {
								return {
									attachment: file.buffer,
									name: file.name,
									description: file.description
								}
							})
						})
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
				if (message.author.id != client.user.id && message.author.username != config.OwnerUserName) return
			(ChannelMessageQueues[message.channel.id] ??= []).push(message)
			if (!in_hypnosis_channel_id || message.channel.id == in_hypnosis_channel_id)
				ChannelHandlers[message.channel.id] ??= HandleMessageQueue(message.channel.id)
		} catch (error) {
			ErrorHandler(error, message)
		}
	})
	client.on(Events.MessageUpdate, async (message) => {
		if (message.author.id === client.user.id) return
		const chatlog = ChannelChatLogs[message.channel.id] || []
		// 我们先检查下这个消息是否在消息记录中，若不在直接跳过
		if (!chatlog.find(logentry => logentry.extension?.discord_messages?.find(id => id == message.id))) return
		const Update = chatlog.find(logentry => logentry.extension?.discord_messages?.find(id => id == message.id))
		if (Update) {
			const newlog = MargeChatLog(await Promise.all(Update.extension.discord_messages.map(DiscordMessageToFountChatLogEntry)))[0]
			for (const key in newlog) Update[key] = newlog[key]
			for (const key in Update) if (!(key in newlog)) delete Update[key]
			Update.content += '\n（已编辑）'
			return
		}
	})
	console.info('bot ' + client.user.username + ' ready!')
}
