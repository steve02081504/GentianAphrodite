import fs from 'node:fs'

import { chardir } from '../../charbase.mjs'

/**
 * 贴纸名 -> Discord emoji 映射，emoji 名即贴纸名，取自贴纸资源目录。
 */
export const discordStickers = Object.fromEntries(
	fs.readdirSync(chardir + '/public/imgs/stickers').map(fileName => {
		const name = fileName.replace(/\.avif$/, '')
		return [name, { emojiName: name }]
	}),
)
