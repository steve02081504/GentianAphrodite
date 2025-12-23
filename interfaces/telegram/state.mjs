/** @typedef {import('npm:telegraf').Telegraf} TelegrafInstance */
/** @typedef {import('npm:telegraf/typings/core/types/typegram').UserFromGetMe} TelegramBotInfo */
/** @typedef {import('npm:telegraf/typings/core/types/typegram').User} TelegramUser */
/** @typedef {import('../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts').FountChatReply_t} FountChatReply_t */

/**
 * Telegraf 实例的引用。
 * @type {TelegrafInstance | null}
 */
export let telegrafInstance = null

/**
 * 设置 Telegraf 实例。
 * @param {TelegrafInstance} instance - Telegraf 实例。
 * @returns {void}
 */
export function setTelegrafInstance(instance) {
	telegrafInstance = instance
}

/**
 * Telegram Bot 自身的信息 (通过 getMe() 获取)。
 * @type {TelegramBotInfo | null}
 */
export let telegramBotInfo = null

/**
 * 设置 Telegram 机器人信息。
 * @param {TelegramBotInfo} info - Telegram 机器人信息对象。
 * @returns {void}
 */
export function setTelegramBotInfo(info) {
	telegramBotInfo = info
}

/**
 * Telegram 用户对象缓存。
 * 键为用户 ID (number)，值为 Telegram User 对象。
 * @type {Record<number, TelegramUser>}
 */
export const telegramUserCache = {}

/**
 * Telegram 用户 ID到其规范化显示名称的映射。
 * 键为用户 ID (number)，值为用户显示名称 (string)。
 * @type {Record<number, string>}
 */
export const telegramUserIdToDisplayName = {}

/**
 * Telegram 用户规范化显示名称到其用户 ID 的映射。
 * 键为显示名称 (string)，值为用户 ID (number)。
 * @type {Record<string, number>}
 */
export const telegramDisplayNameToId = {}

/**
 * 缓存由 AI 生成并已发送的 FountChatReply_t 对象。
 * 键为第一条成功发送的 Telegram 消息的 ID (number)，值为原始的 {@link FountChatReply_t} 对象。
 * @type {Record<number, FountChatReply_t>}
 */
export const aiReplyObjectCache = {}
