export let rude_words = [
	'傻逼', '白痴', '蠢货', '弱智', '傻子', '废物', '下贱', '低能', '无能', '死妈', '恶心', '不知死活', '活得不耐烦',
	'骂人', '人身攻击', '歧视', '侮辱', '生气', '呃呃', '阴阳怪气', '死',
	'禁言', '踢了', '飞了', '杀了', '肏了'
]
export let Kaomoji_list = [
	'(*´▽｀*)ヾ', '(＃￣ω￣)', '(￣▽￣)ノ', '(⊙ω⊙)', '(｡•̀ᴗ-)✧',
	'(*/ω＼*)', '(｀・ω・´)', '(￣▽￣)', '(*°∀°)=3', 'ヾ(^▽^*)',
	'(*´▽`*)', '(≧▽≦)', '(⁄ ⁄•⁄ω⁄•⁄ ⁄)', '(｡♥‿♥｡)',
	'(￣︶￣)', '(๑•̀ㅂ•́)و ', '(╯°□°)╯', '(≧∇≦)/', '⊙ω⊙', '(*≧ω≦)',
	'(*≧▽≦)ノ', '(〃￣︶￣〃)', '（*´▽｀*）', '(っ´ω`)っ', '( ̩̩̩(˃̣̣̥A˂̣̣̥ )'
]

export function remove_kaomoji(text) {
	for (let kaomoji of Kaomoji_list)
		text = text.replaceAll(kaomoji, '')
	return text
}
