import { chardir, charurl, charvar } from '../charbase.mjs'
import { FormatStr } from '../scripts/tools.mjs'
import fs from 'node:fs'

export default {
	name: 'Gentian',
	avatar: `${charurl}/imgs/anime.avif`,
	description: 'A complex legal loli wife with a massive details & features!',
	description_markdown: FormatStr(fs.readFileSync(chardir + '/info/description/en-US.md', 'utf8'), { charvar }),
	version: charvar,
	author: 'steve02081504',
	homepage: '',
	tags: [
		'pure love', // 纯爱
		'romance', // 恋爱
		'lovers', // 爱人
		'mind control', // 洗脑
		'breast milk', // 母乳
		'nipple fuck', // 乳头插入
		'vore', // 丸吞
		'loli', // 萝莉
		'legal loli', // 合法萝莉
		'motherly', // 母性
		'obsessive', // 重女，通常直接翻译为obsessive 省去love
		'isolating yandere', // 孤立型病娇
		'gaslighting',
		'master-love',
		'noble', // 贵族
		'humanoid', // 类人
		'character focus', // 纯人物
		'male oriented', // 男性向
		'female character', // 女性角色
	]
}
