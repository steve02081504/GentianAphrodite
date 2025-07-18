/**
 * Discord.js 客户端实例的引用。
 * @type {import('npm:discord.js').Client}
 */
export let discordClientInstance

/**
 * 设置 Discord.js 客户端实例。
 * @param {import('npm:discord.js').Client} client - 客户端实例。
 */
export function setDiscordClientInstance(client) {
	discordClientInstance = client
}

/**
 * 缓存的主人 Discord 用户 ID。
 * @type {string | null}
 */
export let resolvedOwnerId = null

/**
 * 设置已解析的主人 Discord 用户 ID。
 * @param {string | null} ownerId - 主人用户 ID。
 */
export function setResolvedOwnerId(ownerId) {
	resolvedOwnerId = ownerId
}

/**
 * Discord 用户对象缓存。
 * 键为用户 ID (string)，值为 Discord User 对象。
 * @type {Record<string, import('npm:discord.js').User>}
 */
export const discordUserCache = {}

/**
 * Discord 用户 ID到其规范化显示名称的映射。
 * 键为用户 ID (string)，值为用户显示名称 (string)。
 * @type {Record<string, string>}
 */
export const discordUserIdToDisplayName = {}

/**
 * Discord 用户规范化显示名称到其用户 ID 的映射。
 * 键为显示名称 (string)，值为用户 ID (string)。
 * @type {Record<string, string>}
 */
export const discordDisplayNameToId = {}

/**
 * 缓存由 AI 生成并已发送的 FountChatReply_t 对象。
 * 键为第一条成功发送的 Discord 消息的 ID (string)，值为原始的 {@link FountChatReply_t} 对象。
 * @type {Record<string, import('../../../../../../../src/public/shells/chat/decl/chatLog.ts').FountChatReply_t>}
 */
export const aiReplyObjectCache = {}
