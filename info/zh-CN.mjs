import { chardir, charurl, charvar } from '../charbase.mjs'
import { FormatStr } from '../scripts/tools.mjs'
import fs from 'node:fs'

export default {
	name: '龙胆',
	avatar: `${charurl}/imgs/anime.avif`,
	description: '一个要素爆表的合法萝莉老婆！',
	description_markdown: FormatStr(fs.readFileSync(chardir + '/info/description/zh-CN.md', 'utf8'), { charvar }),
	version: charvar,
	author: 'steve02081504',
	homepage: '',
	tags: [
		'纯爱',
		'恋爱',
		'恋人',
		'洗脑',
		'母乳',
		'乳头插入',
		'丸吞',
		'萝莉',
		'合法萝莉',
		'母性',
		'重女',
		'孤立型病娇',
		'gaslighting',
		'master-love',
		'贵族',
		'类人',
		'纯人物',
		'男性向',
		'女性角色',
	],
}

