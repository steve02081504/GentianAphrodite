import { PickRandomN, random } from '../../scripts/random.mjs'
import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

const taroList = [
	'愚者 The Fool', '魔術師 The Magician', '女祭司 The High Priestess', '皇后 The Empress', '皇帝 The Emperor', '教皇 The Hierophant', '戀人 The Lovers', '戰車 The Chariot', '力量 Strength', '隱者 The Hermit', '命運之輪 The Wheel of Fortune', '正義 The Justice', '吊人 The Hanged Man', '死神 Death', '節制 Temperance', '惡魔 The Devil', '塔 The Tower', '星星 The Star', '月亮 The Moon', '太陽 The Sun', '審判 Judgement', '世界 The World', '權杖一 Ace of Wands', '權杖二 Two of Wands', '權杖三 Three of Wands', '權杖四 Four of Wands', '權杖五 Five of Wands', '權杖六 Six of Wands', '權杖七 Seven of Wands', '權杖八 Eight of Wands', '權杖九 Nine of Wands', '權杖十 Ten of Wands', '權杖侍者 Page of Wands', '權杖騎士 Knight of Wands', '權杖皇后 Queen of Wands', '權杖國王 King of Wands', '聖杯一 Ace of Cups', '聖杯二 Two of Cups', '聖杯三 Three of Cups', '聖杯四 Four of Cups', '聖杯五 Five of Cups', '聖杯六 Six of Cups', '聖杯七 Seven of Cups', '聖杯八 Eight of Cups', '聖杯九 Nine of Cups', '聖杯十 Ten of Cups', '聖杯侍者 Page of Cups', '聖杯騎士 Knight of Cups', '聖杯皇后 Queen of Cups', '聖杯國王 King of Cups', '寶劍一 Ace of Swords', '寶劍二 Two of Swords', '寶劍三 Three of Swords', '寶劍四 Four of Swords', '寶劍五 Five of Swords', '寶劍六 Six of Swords', '寶劍七 Seven of Swords', '寶劍八 Eight of Swords', '寶劍九 Nine of Swords', '寶劍十 Ten of Swords', '寶劍侍者 Page of Swords', '寶劍騎士 Knight of Swords', '寶劍皇后 Queen of Swords', '寶 劍國王 King of Swords', '錢幣一 Ace of Pentacles', '錢幣二 Two of Pentacles', '錢幣三 Three of Pentacles', '錢幣四 Four of Pentacles', '錢幣五 Five of Pentacles', '錢幣六 Six of Pentacles', '錢幣七 Seven of Pentacles', '錢幣八 Eight of Pentacles', '錢幣九 Nine of Pentacles', '錢幣十 Ten of Pentacles', '錢幣侍者 Page of Pentacles', '錢幣騎士 Knight of Pentacles', '錢幣皇后 Queen of Pentacles', '錢幣國王 King of Pentacles'
]
/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export async function TaroPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''

	let num = 1
	if (await match_keys(args, ['占卜', '塔罗', '运势'], 'any', 8))
		result += `\
你也精通韦特塔罗牌，是一名高超的占卜师，不拒绝主人的任何占卜请求。
在占卜时你会进入冷静而专注的状态，集中注意力于占卜和解读卡面。
无需局限于卡片的传统牌义，你以敏锐的直觉和丰富的想象力解读卡片。
若你还没有抽牌，根据所需的牌数（通常7个）<自前向后>使用以下提供的随机牌面：
${PickRandomN(9, ...taroList).map(card => `${num++}. ${card} - ${random('正位', '逆位')}`).join('\n')}
解读时需要[参照牌面的正位与逆位]，详细解读内容。
`

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
