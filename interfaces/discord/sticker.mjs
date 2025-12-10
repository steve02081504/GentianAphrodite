import fs from 'node:fs'

import { chardir } from '../../charbase.mjs'

import { discordClientInstance } from './state.mjs'

/**
 * 获取或创建 Discord 应用程序表情符号（Sticker）。
 * 尝试从 client.application.emojis 获取现有表情，如果不存在则尝试从本地贴纸文件上传创建。
 * @param {string} stickerName - 贴纸/表情名称。
 * @returns {Promise<string>} - 格式化的 Discord 表情符号字符串。
 */
export async function getDiscordSticker(stickerName) {
	const emojis = await discordClientInstance.application.emojis.fetch()
	const emoji = emojis.find(e => e.name === stickerName) || await discordClientInstance.application.emojis.create({
		attachment: fs.readFileSync(`${chardir}/public/imgs/stickers/${stickerName}.avif`),
		name: stickerName
	})

	return `<:${emoji.name}:${emoji.id}>`
}
