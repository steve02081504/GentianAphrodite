import { Client, Events, Message } from 'discord.js'
import { base_match_keys } from '../../scripts/match.mjs'
import { GetReply } from '../../reply_gener/index.mjs'
import GentianAphrodite from '../../main.mjs'
/** @typedef {import('../../../../../../../src/public/shells/chat/decl/chatLog').chatLogEntry_t} chatLogEntry_t */

const MAX_MESSAGE_DEPTH = 40

/**
 * @typedef {{
 * 	ownerUserName: string
 * 	OwnnerNameKeywords: string[]
 * }} discord_config_t
 */

/**
 * @param {Client} client
 * @param {discord_config_t} config
 */
export default function DiscordBotMain(client, config) {
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
			/** @type {chatLogEntry_t} */
			let result = {
				timeStamp: message.createdTimestamp,
				role: message.author.username === config.ownerUserName ? 'user' : 'char',
				name,
				content: message.content,
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

		if (message.author.username === config.ownerUserName) {
			if (message.content.substring(0, 5).includes('龙胆')) return true
			if (base_match_keys(message.content, ['老婆', '女票', '女朋友', '炮友'])) matchs += 50
			if (base_match_keys(message.content, ['救救', '帮帮', '帮我', '来人'])) return true
			possible += 7 // 多出 7% 的可能性回复主人
		}
		if (message.mentions.users.has(config.ownerUserName)) {
			matchs += 7 // 多出 7% 的可能性回复提及主人的消息
			if (base_match_keys(message.content, ['傻逼', '白痴', '弱智', '傻子', '死妈'])) return true // 提及还骂人？你妈妈没了
		}
		if (message.mentions.users.has(client.user.id)) {
			possible += 40 // 多出 40% 的可能性回复提及自己的消息
			if (base_match_keys(message.content, ['傻逼', '白痴', '弱智', '傻子', '死妈'])) return true // 提及还骂人？你妈妈没了
			if (base_match_keys(message.content, ['你主人', '你的主人'])) return true
		}

		let result = Math.random() < possible / 100
		console.log('CheckMessageContentTrigger', possible + '%', result)
		return result
	}

	let timer
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
			let typeingInterval = setInterval(() => { message.channel.sendTyping() }, 5000)

			clearTimeout(timer)
			timer = setTimeout(async () => {
				timer = null
				let messages = await message.channel.messages.fetch({ limit: MAX_MESSAGE_DEPTH })
				let reply = await GetReply({
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
					chat_log: await DiscordMessagesToFountChatLog(messages),
				})

				if (reply) message.reply(reply)

				clearInterval(typeingInterval)
			}, 3000)
		}
	})
}
