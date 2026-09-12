import { lewd_words } from '../../scripts/dict.mjs'
import { match_keys } from '../../scripts/match.mjs'

/**
 * 判断对话是否进入 NSFW 情境。
 * @param {object} args 聊天回复请求
 * @param {object} result 逻辑结果
 */
export async function classifyNsfw(args, result) {
	if (!result.in_assist && (await match_keys(args, lewd_words, 'both', 3) || await match_keys(args, [
		'束缚', '乳尖', '乳房', '体液', '内衣', '内裤', '前戏', '双峰', '吞', '吻', '奶头', '乳头', '奶牛', '巨乳', '性感', '愉悦', '拉屎',
		'抽打', '拍打', '拷问', '挖弄', '捆绑', '排泄', '插入', '插进', '母牛', '母狗', '母猪', '气味', '湿身', '炮友', '爆乳', '自慰',
		'舒爽', '豆豆', '高潮', '胸罩', '大家伙', '痴迷', '床铺', '风骚', '鞭打', '鞭笞', '消化', '浪妇'
	], 'both', 3) > 2
	))
		result.in_nsfw = true
}
