// 文件名: ./interfaces/discord/index.mjs (或根据你的项目结构调整路径)

import { Events, ChannelType, ActivityType } from 'npm:discord.js'
import { Buffer } from 'node:buffer'

// 从 Bot 逻辑层导入核心处理函数和配置函数
import { processIncomingMessage, processMessageUpdate, cleanup as cleanupBotLogic } from '../../bot_core/index.mjs'
// 假设你的角色基础信息可以通过以下路径导入
import { charname as BotFountCharname } from '../../charbase.mjs'


// Discord 接口特定的工具、插件和世界观
import { get_discord_api_plugin } from './api.mjs'
import { discordWorld } from './world.mjs'
import { getMessageFullContent, splitDiscordReply } from './tools.mjs'
import { tryFewTimes } from '../../scripts/tryFewTimes.mjs' // 复用脚本
import { mimetypeFromBufferAndName } from '../../scripts/mimetype.mjs' // 复用脚本
import { escapeRegExp } from '../../scripts/tools.mjs'

/**
 * Bot 逻辑层定义的平台 API 对象类型。
 * @typedef {import('../../bot_core/index.mjs').PlatformAPI_t} PlatformAPI_t
 */
/**
 * Bot 逻辑层定义的扩展聊天日志条目类型。
 * @typedef {import('../../bot_core/index.mjs').chatLogEntry_t_ext} chatLogEntry_t_ext
 */
/**
 * Fount 定义的聊天回复对象类型。
 * @typedef {import('../../../../../../../src/public/shells/chat/decl/chatLog.ts').FountChatReply_t} FountChatReply_t
 */
/**
 * Discord.js 的消息对象类型。
 * @typedef {import('npm:discord.js').Message} DiscordMessage
 */
/**
 * Discord.js 的文本频道对象类型。
 * @typedef {import('npm:discord.js').TextChannel} DiscordTextChannel
 */
/**
 * Discord.js 的私聊频道对象类型。
 * @typedef {import('npm:discord.js').DMChannel} DiscordDMChannel
 */
/**
 * Discord.js 的用户对象类型。
 * @typedef {import('npm:discord.js').User} DiscordUser
 */
/**
 * Discord.js 的服务器成员对象类型。
 * @typedef {import('npm:discord.js').GuildMember} DiscordGuildMember
 */

/**
 * Discord 接入层配置对象类型定义。
 * @typedef {{
 *  OwnerUserName: string, // Discord 用户名
 *  OwnerNameKeywords: string[], // 可能的用户名关键字列表
 *  BotActivityName?: string, // 机器人状态中显示的游戏/活动名称
 *  BotActivityType?: keyof typeof ActivityType, // 机器人状态类型 (例如 'Playing', 'Listening', 'Watching', 'Competing')
 * }} DiscordInterfaceConfig_t
 */

/**
 * 获取此 Discord 接口的配置模板。
 * @returns {DiscordInterfaceConfig_t} 配置模板对象。
 */
export function GetBotConfigTemplate() {
	return {
		OwnerUserName: 'your_discord_username', // 请替换为你的 Discord 用户名
		OwnerNameKeywords: [
			'your_name_keyword1',
			'your_name_keyword2',
		],
		BotActivityName: '主人', // 机器人正在玩的游戏/活动名称
		BotActivityType: 'Watching', // 活动类型, 例如: Playing, Listening, Watching, Competing
	}
}

/**
 * Discord.js 客户端实例的引用。
 * @type {Client}
 */
let discordClientInstance

/**
 * Discord 用户对象缓存。
 * 键为用户 ID (string)，值为 Discord User 对象。
 * @type {Record<string, DiscordUser>}
 */
const discordUserCache = {}

/**
 * Discord 用户 ID到其规范化显示名称的映射。
 * 键为用户 ID (string)，值为用户显示名称 (string)。
 * @type {Record<string, string>}
 */
const discordUserIdToDisplayName = {}

/**
 * Discord 用户规范化显示名称到其用户 ID 的映射。
 * 主要用于机器人自身的名称和 Fount 角色名的映射。
 * 键为显示名称 (string)，值为用户 ID (string)。
 * @type {Record<string, string>}
 */
const discordDisplayNameToId = {}

/**
 * 缓存由 AI 生成并已发送的 FountChatReply_t 对象。
 * 键为第一条成功发送的 Discord 消息的 ID (string)，值为原始的 {@link FountChatReply_t} 对象。
 * 用于在机器人自身消息被 BotLogic 层处理时，能够恢复 AI 可能附加在回复对象中的扩展信息。
 * @type {Record<string, FountChatReply_t>}
 */
const aiReplyObjectCache = {}


/**
 * 将 Discord 消息对象转换为 Bot 逻辑层可以理解的 Fount 聊天日志条目格式。
 * @async
 * @param {DiscordMessage} message - 从 Discord 收到的原始消息对象。
 * @param {DiscordInterfaceConfig_t} interfaceConfig - 当前 Discord 接口的配置对象。
 * @returns {Promise<chatLogEntry_t_ext | null>} 转换后的 Fount 聊天日志条目。如果消息无效或不应处理 (如系统消息)，则返回 null。
 */
async function discordMessageToFountChatLogEntry(message, interfaceConfig) {
	// 尝试从缓存获取作者信息，或从 Discord API 拉取并缓存
	const author = discordUserCache[message.author.id] || message.author
	if (!discordUserCache[message.author.id] || Math.random() < 0.1)  // 10% 的几率或缓存未命中时更新
		try {
			const fetchedUser = await message.author.fetch() // 强制从 API 获取最新用户信息
			discordUserCache[message.author.id] = fetchedUser
		} catch (fetchError) {
			console.warn(`[DiscordInterface] 无法获取用户 ${message.author.id} 的信息:`, fetchError.message)
		}

	// 构建发送者名称：优先使用 displayName (服务器昵称)，其次 globalName (全局显示名)，最后 username
	let senderName = author.displayName || author.globalName || author.username
	// 如果 username 和最终确定的 senderName (通常是 displayName) 不同，则附加上 username 以便区分
	if (author.username && author.username.toLowerCase() !== senderName.toLowerCase())
		senderName += ` (${author.username})`

	discordUserIdToDisplayName[author.id] = senderName // 更新 ID -> 显示名称的映射

	// 特殊处理机器人自身发送的消息的名称
	if (author.id === discordClientInstance.user?.id) {
		const botDisplayName = discordClientInstance.user.displayName || discordClientInstance.user.globalName || BotFountCharname
		discordDisplayNameToId[botDisplayName] = author.id // 映射：机器人显示名 -> ID
		discordDisplayNameToId[BotFountCharname] = author.id // 映射：Fount角色核心名 -> ID
		discordUserIdToDisplayName[author.id] = `${botDisplayName} (咱自己)` // 为机器人自身创建一个特殊的显示名
		senderName = discordUserIdToDisplayName[author.id]
	}

	// 使用工具函数获取完整的消息内容 (包括 embed、附件链接、回复等格式化文本)
	const content = await getMessageFullContent(message, discordClientInstance)

	// 处理消息附件和 embed 中的图片，转换为 Fount 文件格式
	const files = (await Promise.all(
		[...message.attachments.values(), ...message.embeds.filter(e => e.image).map(e => e.image)] // 合并附件和 embed 图片
			.filter(Boolean) // 过滤掉空值
			.map(async (attachmentOrEmbedImage) => {
				const {url} = attachmentOrEmbedImage
				if (!url) return null
				try {
					const response = await tryFewTimes(() => fetch(url)) // 尝试多次获取文件
					if (!response.ok) throw new Error(`获取文件失败 ${url}: ${response.statusText}`)
					const buffer = Buffer.from(await response.arrayBuffer()) // 将文件内容转为 Buffer
					const name = attachmentOrEmbedImage.name || url.split('/').pop() || 'file' // 获取文件名
					const mimeType = attachmentOrEmbedImage.contentType || await mimetypeFromBufferAndName(buffer, name) // 获取MIME类型
					const description = attachmentOrEmbedImage.description || (attachmentOrEmbedImage.title || '') // 获取描述或标题
					return { name, buffer, description, mimeType }
				} catch (error) {
					console.error(`[DiscordInterface] 处理附件/embed图片 ${url} 失败:`, error)
					return null
				}
			})
	)).filter(Boolean) // 再次过滤处理失败的 null 值

	// 如果消息既无文本内容也无有效文件，则忽略
	if (!content && files.length === 0) return null

	// --- 构造 Fount 日志条目的扩展信息 (extension) ---
	const isDirectMessage = message.channel.type === ChannelType.DM // 判断是否为私聊消息

	// 判断消息是否来自配置的“主人”
	const isFromOwner = message.author.username === interfaceConfig.OwnerUserName

	// 判断消息是否提及了机器人自身
	// 通过 Discord 的 mentions集合检查，或简单地在消息内容中检查 Fount 角色名 (不区分大小写)
	const mentionsBot = message.mentions.users.has(discordClientInstance.user?.id || '') ||
		(BotFountCharname && content.toLowerCase().includes(BotFountCharname.toLowerCase()))

	// 判断消息是否提及了配置的“主人”
	const mentionsOwner = message.mentions.users.some(user => user.username === interfaceConfig.OwnerUserName)

	/** @type {chatLogEntry_t_ext} */
	const fountEntry = {
		timeStamp: message.editedTimestamp || message.createdTimestamp, // 使用编辑时间戳 (如果存在)，否则使用创建时间戳
		role: isFromOwner ? 'user' : 'char', // 'user'代表主人，'char'代表机器人或其他用户
		name: senderName, // 发送者名称
		content, // 消息文本内容
		files, // 消息文件列表
		extension: { // 平台特定的扩展信息
			platform: 'discord', // 平台标识
			OwnerNameKeywords: interfaceConfig.OwnerNameKeywords, // 主人名称关键字列表
			platform_message_ids: [message.id], // 原始 Discord 消息 ID 列表 (目前只存一个)
			platform_channel_id: message.channel.id, // 原始 Discord 频道 ID
			platform_user_id: message.author.id, // 原始 Discord 用户 ID
			platform_guild_id: message.guild?.id, // 原始 Discord 服务器 ID (如果不是私聊)
			is_direct_message: isDirectMessage, // 是否为私聊
			is_from_owner: isFromOwner, // 是否来自主人
			mentions_bot: mentionsBot, // 是否提及机器人
			mentions_owner: mentionsOwner, // 是否提及主人
			discord_message_obj: message, // 可选: 传递原始 Discord Message 对象，供插件等高级用途
			...aiReplyObjectCache[message.id]?.extension, // 合并从缓存中恢复的 AI 相关的扩展信息
		}
	}
	delete aiReplyObjectCache[message.id] // 清空缓存
	return fountEntry
}

/**
 * 格式化文本中的提及，将 @用户名 转换为 <@用户ID>。
 * @param {string} text - 原始文本。
 * @param {Map<string, string>} [guildMembersMap] - (可选) 一个 Map 对象，键为小写的用户名或显示名，值为用户ID。
 *                                                 如果提供，则会尝试转换文本中的 @提及。
 * @returns {string} 格式化后的文本。
 */
function formatEmbedMentions(text, guildMembersMap) {
	if (!text || !guildMembersMap || guildMembersMap.size === 0)
		return text // 如果没有文本、没有成员映射或映射为空，则直接返回原文


	// 构建一个正则表达式，用于匹配所有可能的被提及的用户名或显示名
	// 我们需要对映射中的键进行排序，使得较长的名字优先匹配 (避免 "steve" 匹配了 "steve0208")
	const sortedNames = Array.from(guildMembersMap.keys()).sort((a, b) => b.length - a.length)

	if (sortedNames.length === 0)
		return text // 如果排序后没有名字了（理论上不应发生，除非 guildMembersMap 都是空字符串键）


	// 正则表达式：匹配 @ 符号后紧跟着的、已知的用户名或显示名。
	// (?!\\w) 是一个负向先行断言，确保匹配的名称后面不是字母、数字或下划线，
	// 这样可以避免错误地匹配如 "@usernameABC" 中的 "@username"。
	// 我们需要转义名称中的特殊正则字符。
	const mentionRegex = new RegExp(`@(${sortedNames.map(name => escapeRegExp(name)).join('|')})(?!\\w)`, 'gi')
	// 使用 'gi' flag: g for global (匹配所有出现), i for case-insensitive (忽略大小写)

	return text.replace(mentionRegex, (match, matchedName) => {
		// matchedName 是正则表达式中第一个捕获组的内容，即 @ 后面的名字部分。
		// 在 guildMembersMap 中查找（不区分大小写，因为 map 的键已是小写）
		const userId = guildMembersMap.get(matchedName.toLowerCase())
		if (userId)
			return `<@${userId}>` // 如果找到用户ID，则替换为 Discord 提及格式

		return match // 如果没找到（理论上不应发生，因为正则基于 map 的键构建），则保持原样
	})
}

/**
 * Discord Bot 的主设置和事件处理函数。
 * 此函数负责初始化 Discord 客户端，配置 Bot 逻辑层，并设置事件监听器。
 * @param {Client} client - 已初始化的 Discord.js 客户端实例。
 * @param {DiscordInterfaceConfig_t} interfaceConfig - 传递给此 Discord 接口的特定配置对象。
 */
export async function DiscordBotMain(client, interfaceConfig) {
	discordClientInstance = client // 保存客户端实例，供 PlatformAPI 等内部函数使用

	/**
	 * 构建并返回一个实现了 {@link PlatformAPI_t} 接口的对象。
	 * 这个对象封装了所有与 Discord 平台交互的具体操作，供 Bot 逻辑层调用。
	 * @type {PlatformAPI_t}
	 */
	const discordPlatformAPI = {
		name: 'discord',
		/** 接入层自身的配置对象 */
		config: interfaceConfig,

		/**
		 * 发送消息到指定的 Discord 频道。
		 * @param {string | number} channelId - 目标 Discord 频道的 ID。
		 * @param {FountChatReply_t} fountReplyPayload - 由 Bot 逻辑层生成的、包含回复内容的 Fount 回复对象。
		 * @param {chatLogEntry_t_ext} [originalMessageEntry] - (可选) 触发此次回复的原始消息条目，用于在 Discord 上下文显示为“回复”。
		 * @returns {Promise<chatLogEntry_t_ext | null>} 如果发送成功，则返回代表第一条已发送消息的 Fount 日志条目；否则返回 null。
		 */
		async sendMessage(channelId, fountReplyPayload, originalMessageEntry) {
			const channel = await client.channels.fetch(String(channelId)).catch(() => null)
			if (!channel || !(channel.isTextBased() || channel.type === ChannelType.DM)) {
				console.error(`[DiscordInterface] sendMessage: 无效频道或未找到频道: ${channelId}`)
				return null
			}

			// 尝试获取被回复的原始 Discord 消息对象 (如果提供了 originalMessageEntry)
			let repliedToDiscordMessage
			if (originalMessageEntry?.extension?.platform_message_ids?.[0])
				try {
					repliedToDiscordMessage = await /** @type {DiscordTextChannel | DiscordDMChannel} */ channel.messages.fetch(originalMessageEntry.extension.platform_message_ids[0])
				} catch { /* 原始消息可能已被删除，静默处理，后续发送时不使用 .reply() */ }


			const textContent = fountReplyPayload.content || '' // 获取文本内容
			const filesToSend = (fountReplyPayload.files || []).map(f => ({ // 转换文件格式
				attachment: f.buffer, name: f.name || 'file.dat', description: f.description
			}))

			const splitTexts = splitDiscordReply(textContent, 2000) // 使用工具函数按 Discord 限制分割长文本
			let firstSentDiscordMessage = null // 用于存储第一条成功发送的 Discord 消息对象
			let guildMembersMap // 用于在服务器频道中转换 @用户名 提及

			// 如果在服务器频道且文本中包含 "@"，尝试获取服务器成员列表以进行提及转换
			if (channel.type !== ChannelType.DM && textContent.includes('@'))
				try {
					const membersCollection = await client.guilds.cache.get(channel.guildId)?.members.fetch()
					if (membersCollection) {
						guildMembersMap = new Map() // 小写用户名/显示名 -> 用户ID
						membersCollection.forEach(member => {
							guildMembersMap.set(member.user.username.toLowerCase(), member.id)
							guildMembersMap.set(member.displayName.toLowerCase(), member.id)
						})
					}
				} catch (err) { console.warn('[DiscordInterface] 获取服务器成员列表以转换提及失败:', err.message) }


			// 情况1: 只有文件，没有文本
			if (splitTexts.length === 0 && filesToSend.length > 0)
				try {
					const sentMsg = repliedToDiscordMessage // 如果有原始消息，则作为回复发送
						? await repliedToDiscordMessage.reply({ files: filesToSend, allowedMentions: { repliedUser: true } }) // repliedUser:true 会 ping 原作者
						: await /** @type {DiscordTextChannel | DiscordDMChannel} */ channel.send({ files: filesToSend })
					firstSentDiscordMessage = sentMsg
				} catch (e) { console.error('[DiscordInterface] 发送仅文件消息失败:', e) }
			 else  // 情况2: 有文本 (可能也有文件)
				for (let i = 0; i < splitTexts.length; i++) {
					const textPart = formatEmbedMentions(splitTexts[i], guildMembersMap) // 转换文本中的 @用户名 提及
					const isLastPart = i === splitTexts.length - 1 // 是否为最后一条文本片段
					try {
						const messageOptions = {
							content: textPart,
							files: isLastPart ? filesToSend : [], // 只有最后一条文本消息附带所有文件
							allowedMentions: { parse: ['users', 'roles'], repliedUser: !!repliedToDiscordMessage } // 允许提及用户和角色，控制是否 ping 回复用户
						}
						// 第一条消息尝试使用 .reply() (如果 repliedToDiscordMessage 存在)，后续消息使用 .send()
						const sentMsg = repliedToDiscordMessage && i === 0
							? await repliedToDiscordMessage.reply(messageOptions)
							: await /** @type {DiscordTextChannel | DiscordDMChannel} */ channel.send(messageOptions)

						if (i === 0) firstSentDiscordMessage = sentMsg // 保存第一条发送成功的消息
						if (repliedToDiscordMessage && i === 0) repliedToDiscordMessage = undefined // 后续分片不再是直接回复原始消息
					} catch (e) { console.error(`[DiscordInterface] 发送消息片段 ${i + 1} 失败:`, e); break /* 中断发送后续片段 */ }
				}


			// 如果成功发送了至少一条消息
			if (firstSentDiscordMessage) {
				// 如果此回复是由 AI 生成的 (即 fountReplyPayload 包含实际内容)
				// 并且 BotLogic 希望缓存此 fountReplyPayload (通常是 AI 的最终回复对象，可能包含扩展状态)
				// 则将其存入 aiReplyObjectCache，以便后续机器人自身消息被处理时可以恢复这些状态。
				if (fountReplyPayload && (fountReplyPayload.content || fountReplyPayload.files?.length))
					aiReplyObjectCache[firstSentDiscordMessage.id] = fountReplyPayload

				// 将发送成功的 Discord 消息转换为 FountEntry 并返回给 BotLogic
				return await discordMessageToFountChatLogEntry(firstSentDiscordMessage, interfaceConfig)
			}
			return null // 发送失败或无内容发送
		},

		/**
		 * 在指定频道发送“正在输入...”状态。
		 * @param {string | number} channelId - 目标 Discord 频道的 ID。
		 * @returns {Promise<void>}
		 */
		async sendTyping(channelId) {
			const channel = client.channels.cache.get(String(channelId))
			if (channel?.isTextBased())  // 确保是文本型频道
				try {
					await /** @type {DiscordTextChannel | DiscordDMChannel} */ channel.sendTyping()
				} catch (e) { /* 发送 typing 状态失败通常不关键，静默处理 */ }

		},

		/**
		 * 获取指定 Discord 频道的历史消息。
		 * @param {string | number} channelId - 目标 Discord 频道的 ID。
		 * @param {number} limit - 要获取的消息数量上限。
		 * @returns {Promise<chatLogEntry_t_ext[]>} 转换后的 Fount 聊天日志条目数组 (按时间从旧到新排序)。
		 */
		async fetchChannelHistory(channelId, limit) {
			const channel = await client.channels.fetch(String(channelId)).catch(() => null)
			if (!channel || !channel.isTextBased()) return [] // 无效频道或非文本频道

			try {
				const messages = await /** @type {DiscordTextChannel | DiscordDMChannel} */ channel.messages.fetch({ limit })
				const fountEntries = (await Promise.all(
					messages.map(msg => discordMessageToFountChatLogEntry(msg, interfaceConfig)) // 转换每条消息
				)).filter(Boolean).reverse() // Discord API 返回的是最新的在前，所以需要反转顺序
				return fountEntries
			} catch (e) {
				console.error(`[DiscordInterface] 获取频道 ${channelId} 历史消息失败:`, e)
				return []
			}
		},

		/** 获取机器人自身的 Discord 用户 ID。 */
		getBotUserId: () => client.user?.id || '',
		/** 获取机器人自身的 Discord 用户名。 */
		getBotUsername: () => client.user?.username || BotFountCharname,
		/** 获取主人的 Discord 用户名。 */
		getOwnerUserName: () => interfaceConfig.OwnerUserName,
		/** 获取主人的 Discord 用户 ID。 */
		getOwnerUserId: () => undefined,
		/** 获取机器人自身的 Discord 显示名称 (服务器昵称或全局显示名)。 */
		getBotDisplayName: () => client.user?.displayName || client.user?.globalName || client.user?.username || BotFountCharname,

		/**
		 * 获取供 AI 使用的、易读的聊天/频道名称。
		 * @param {string | number} channelId - 频道 ID。
		 * @param {chatLogEntry_t_ext} [triggerMessage] - (可选) 触发消息，用于私聊时获取对方用户名。
		 * @returns {string} 格式化后的聊天/频道名称。
		 */
		getChatNameForAI: (channelId, triggerMessage) => {
			const channel = client.channels.cache.get(String(channelId))
			if (!channel) return `Discord: Unknown Channel ${channelId}`
			if (channel.type === ChannelType.DM) { // 私聊
				// 尝试从触发消息的上下文获取私聊对方的信息
				const recipient = triggerMessage?.extension?.discord_message_obj?.channel?.recipient
				return `Discord: DM with ${recipient?.tag || recipient?.username || 'User'}`
			}
			// 服务器文本频道或语音频道中的文本聊天
			if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice) {
				const guildName = /** @type {DiscordTextChannel} */ channel.guild.name
				const channelName = /** @type {DiscordTextChannel} */ channel.name
				return `Discord: Guild ${guildName}: #${channelName}`
			}
			return `Discord: Channel ${channelId}` // 其他未知类型的频道
		},

		/**
		 * 通知接入层执行机器人销毁/下线操作。
		 * @returns {Promise<void>}
		 */
		destroySelf: async () => {
			await cleanupBotLogic() // 首先确保 BotLogic 层完成其清理工作
			client.destroy() // 销毁 Discord 客户端连接
		},

		/**
		 * 记录从 Bot 逻辑层传递过来的错误。
		 * @param {Error} error - 错误对象。
		 * @param {chatLogEntry_t_ext} [contextMessage] - (可选) 发生错误时的上下文消息条目。
		 */
		logError: (error, contextMessage) => {
		},

		/**
		 * 获取特定于 Discord 平台和当前消息上下文的插件列表。
		 * @param {chatLogEntry_t_ext} messageEntry - 当前正在处理的消息条目。
		 * @returns {Record<string, import('../../../../../../../src/decl/pluginAPI.ts').pluginAPI_t>} 插件对象映射。
		 */
		getPlatformSpecificPlugins: (messageEntry) => {
			// 确保 messageEntry 及其 discord_message_obj 存在，以便插件可以访问原始 Discord 消息
			if (messageEntry?.extension?.discord_message_obj)
				return {
					discord_api: get_discord_api_plugin(messageEntry.extension.discord_message_obj),
				}

			return {} // 如果没有上下文消息，则不提供插件
		},

		/** 获取特定于 Discord 平台的世界观配置。 */
		getPlatformWorld: () => discordWorld,

		/**
		 * 根据 Discord 的消息长度限制 (通常为2000字符) 分割长文本回复。
		 * @param {string} text - 原始回复文本。
		 * @returns {string[]} 分割后的消息片段数组。
		 */
		splitReplyText: (text) => splitDiscordReply(text, 2000),
	}

	/**
	 * 监听 'messageCreate' 事件 (当收到新消息时)。
	 */
	client.on(Events.MessageCreate, async (message) => {
		// 尝试重新拉取消息以确保获取到完整数据，并处理消息可能已被删除的情况
		const fetchedMessage = await tryFewTimes(() => message.fetch().catch(e => {
			if (e.code === 10008) return null // DiscordAPIError.MessageNotFound (消息已被删除)
			throw e // 其他错误则抛出
		}))
		if (!fetchedMessage) return // 如果消息已被删除，则不处理

		// 将 Discord 消息转换为 Fount 格式
		const fountEntry = await discordMessageToFountChatLogEntry(fetchedMessage, interfaceConfig)
		if (fountEntry)
			// 将转换后的消息传递给 Bot 逻辑层进行处理
			await processIncomingMessage(fountEntry, discordPlatformAPI, fetchedMessage.channel.id)
		else {
			console.warn(`[DiscordInterface] 收到无效消息，可能是系统消息或格式不支持: ${fetchedMessage.id}`)
			console.dir(fetchedMessage, { depth: null }) // 调试输出消息对象
		}
	})

	/**
	 * 监听 'messageUpdate' 事件 (当消息被编辑时)。
	 */
	client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
		// 尝试拉取更新后的消息
		const fetchedNewMessage = await tryFewTimes(() => newMessage.fetch().catch(e => {
			if (e.code === 10008) return null
			throw e
		}))
		if (!fetchedNewMessage) return // 如果更新后的消息找不到了 (可能又被删了)

		// 将更新后的 Discord 消息转换为 Fount 格式
		const fountEntry = await discordMessageToFountChatLogEntry(fetchedNewMessage, interfaceConfig)
		if (fountEntry)
			// 将更新后的消息传递给 Bot 逻辑层进行处理
			await processMessageUpdate(fountEntry, discordPlatformAPI, fetchedNewMessage.channel.id)

	})

	/**
	 * 监听 'ready' 事件 (当客户端成功登录并准备好时)。
	 */
	client.once(Events.ClientReady, async (c) => {
		// 设置机器人的活动状态 (例如 "正在玩 一个有趣的游戏")
		if (interfaceConfig.BotActivityName && interfaceConfig.BotActivityType)
			client.user?.setPresence({
				activities: [{ name: interfaceConfig.BotActivityName, type: ActivityType[interfaceConfig.BotActivityType] }],
				status: 'online', // 状态: online, idle, dnd, invisible
			})

		// 更新机器人自身的名称映射缓存
		if (client.user) {
			const botUserId = client.user.id
			const botDisplayName = client.user.displayName || client.user.globalName || client.user.username || BotFountCharname
			discordUserIdToDisplayName[botUserId] = `${botDisplayName} (咱自己)`
			discordDisplayNameToId[botDisplayName] = botUserId
			discordDisplayNameToId[BotFountCharname] = botUserId // 确保 Fount 角色名也映射到 ID
		}
	})
}
