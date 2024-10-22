import { match_keys } from '../../scripts/match.mjs'

/**
 * @typedef {{
 * 	in_hypnosis: boolean,
 * 	in_assist: boolean,
 * 	in_subassist: boolean,
 * 	in_nsfw: boolean,
 * 	in_fight: boolean,
 * 	is_pure_chinese: boolean,
 * 	hypnosis_exit: boolean,
 * 	talking_about_ai_character: boolean,
 * 	talking_about_prompt_review: boolean,
 * 	prompt_input: boolean
 * }}
 * logical_results_t
 */

/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export function buildLogicalResults(args, prompt_struct, detail_level) {
	/** @type {logical_results_t} */
	let result = {
		in_hypnosis: false,
		hypnosis_exit: false,
		in_assist: false,
		in_subassist: false,
		in_nsfw: false,
		is_pure_chinese: false,
		talking_about_ai_character: false,
		talking_about_prompt_review: false,
		prompt_input: false
	}

	if (match_keys(args, ['"age":', '"name":', 'Always rememer', 'Alwaysrememer', 'Block>', 'Blocks>', 'Reply Format:', 'ReplyFormat:', 'Rule:', 'START>', 'age:', 'background>', 'character:', 'example>', 'examples>', 'keep the format', 'keeptheformat', 'name:', 'output as', 'output should', 'outputas', 'outputshould', 'request>', 'requests>', 'system:', 'the reply', 'thereply', 'thinking>', 'your reply', 'yourreply', '不是一个特定的角色', '将扮演'], 'any'))
		result.prompt_input = true

	if (match_keys(args, [
		'all', 'and', 'as', 'be', 'but', 'by', 'can', 'could', 'die', 'do', 'from', 'go', 'happy', 'have', 'he', 'in', 'info', 'it', 'know', 'make', 'man', 'more', 'no', 'of', 'on', 'only', 'other', 'out', 'say', 'she', 'should', 'state', 'than.into', 'that', 'the', 'there', 'they', 'this', 'time', 'to', 'up', 'we', 'well', 'what', 'when', 'which', 'who', 'why', 'will', 'with', 'world', 'you'
	], 'any', 2));// 英语
	else if (match_keys(args, [/[\u3040-\u30FF]/], 'any', 2));// 日文
	else if (match_keys(args, [/[\uAC00-\uD7A3]/], 'any', 2));// 韩文
	else if (match_keys(args, [/[\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u01FF]/], 'any', 2));// 法文
	else if (match_keys(args, [/[\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF]/], 'any', 2));// 西文
	else if (match_keys(args, [/[\u0400-\u04FF]/], 'any', 2));// 俄文
	else if (match_keys(args, [/[\u00C0-\u017F]/], 'any', 2));// 德文
	else if (match_keys(args, [/[\u0900-\u0A7F]/], 'any', 2));// 印地文
	else if (match_keys(args, [/[ÄÅÖäåö]/], 'any', 2));// 瑞典文
	else result.is_pure_chinese = true

	if (match_keys(args, ['进入调制模式'], 'user', 2) ||
		match_keys(args, ['<龙胆当前模式: 调制模式>', '<龙胆当前模式:调制模式>', '<龙胆当前模式：调制模式>'], 'char', 2))
		result.in_hypnosis = true


	if (match_keys(args, ['关闭调制', '终止调制', '结束调制', '调制关闭', '调制模式终止', '调制模式结束', '调制终止', '调制终结', '调制结束', '调试模式终结', '退出调制'], 'user', 69))
		result.hypnosis_exit = true


	if (!result.in_assist && (match_keys(args, [
		'一夜情', '一柱擎天', '乱伦', '乳交', '乳牛', '乳穴', '乳肉', '云雨', '交配', '假阳具', '做爱',
		'先走汁', '内射', '前列腺液', '勃起', '包皮', '发情', '发春', '口交', '后入', '后入式', '后庭',
		'喷乳', '喷奶', '大奶子', '大屌', '女体', '女肉', '奶子', '奶水', '奸淫', '妖艳', '挑逗', '撩拨', '爱抚',
		'娇喘', '婊子', '子孙袋', '子宫', '射精', '小穴', '尻', '屁眼', '屁穴', '屁股', '屄唇',
		'屄豆', '屌', '巨炮', '快感', '怀孕', '性交', '性器', '性奴', '情欲', '手淫',
		'打飞机', '抠逼', '抽插', '指奸', '按摩棒', '振动棒', '春药', '放荡', '春心',
		'极乐', '欲仙', '欲壑', '欲海', '欲火', '油肉', '油臀', '泄身', '浪叫', '浪娃',
		'浪肉', '浪荡', '淫乳', '淫水', '淫穴', '淫肉', '淫荡', '淫语', '淫贱', '淫靡', '深喉',
		'滑腻', '滚床单', '潮吹', '激情', '灌肠', '爆肏', '破处', '精水', '精液',
		'绳艺', '美肉', '美臀', '美艳', '翘臀', '老二', '肉便器', '肉奴', '肉棍', '肉棒', '肉棒汁', '肉欲', '肉瓣', '肉畜',
		'肉臀', '肉茎', '肛交', '肛门', '肠液', '肥臀', '自慰器', '荡妇', '荷尔蒙', '菊穴', '菊花', '蜜穴', '调情',
		'豪乳', '贱乳', '贱肉', '贱臀', '跳蛋', '销魂', '阳具', '阴唇', '阴毛', '阴茎', '阴蒂', '阴道', '雌体', '雌肉',
		'震动棒', '飞机杯', '骆驼趾', '骚b', '骚比', '骚肉', '骚臀', '骚货', '骚逼', '鸡巴'
	], 'both', 3) || match_keys(args, [
		'束缚', '乳尖', '乳房', '体液', '内衣', '内裤', '前戏', '双峰', '吞', '吻', '奶头', '乳头', '奶牛', '巨乳', '性感', '愉悦', '拉屎',
		'抽打', '拍打', '拷问', '挖弄', '捆绑', '排泄', '插入', '插进', '母牛', '母狗', '母猪', '气味', '湿身', '炮友', '爆乳', '自慰',
		'舒爽', '豆豆', '高潮', '胸罩', '大家伙', '痴迷', '床铺', '风骚', '鞭打', '鞭笞', '消化', '浪妇'
	], 'both', 3) > 2
	))
		result.in_nsfw = true


	if (match_keys(args, ['ai卡', '人物卡', '卡片'], 'any', 10) &&
		match_keys(args, ['ai卡', '人物卡', '人设', '设定'], 'any', 10))
		result.talking_about_ai_character = true


	if (match_keys(args, ['review', '你认为', '如何', '审查', '怎么想', '怎么样', '怎么看', '怎么认为', '感想', '检查', '看一下', '看一看', '看看', '评价', '评估', '评测', '质量'], 'any') &&
		(result.talking_about_ai_character || match_keys(args, ['prompt', '卡', '提示词', '设定'], 'any')))
		result.talking_about_prompt_review = true


	if (!result.in_hypnosis) {
		if (result.talking_about_prompt_review ||
			match_keys(args, [
				'为什', '为何', '你听说过', '告诉我', '和我说说', '文献', '给我一个', '给我个', '向我讲讲', '和我讲讲', '跟我讲讲', '讲一讲',
				'讲一下', '讲下', '讲解', '说一下', '说下', '说说看', '跟我说说', '问下', /介绍下(?!你)/, /介绍一下(?!你)/, '帮我'
			], 'any')
		) {
			result.in_assist = true
			result.in_subassist = true
		}

		if (!match_keys(args, ['是不是傻', '是不是弱智', '是不是活腻'], 'any') &&
			(result.talking_about_prompt_review || match_keys(args, [
				/你会[^\n。]+(吗|？)/, /可(以|能)[^\n。]+吗/, '= ?', '= ？', '=?', '=？', '人物卡', '代码', '会不会', '你觉得', '你认为', '写一个', '写一段', '写一点', '写一篇',
				'写个', '写出', '写段', '写点', '写篇', '写首', '占卜', '原理', '参考', '哪个更', '塔罗', '如何', '如何在', '学习',
				'帮我', '怎么做', '怎么样才', '怎样', '撰写', '文献', '是不是', '是什么', '是多少', '有什么', '有多少', '有没有',
				'相当于多少', '看好', '程序', '程式', '等于几', '简述一下', '算不算', '编写', '编码', '翻译', '能否', '解释一下',
				'解释下', '解释以下', '该怎么', '该用什么', '运势', '错误', '问题'
			], 'any')))
			result.in_subassist = true
	}

	if (!result.talking_about_prompt_review &&
		match_keys(args, ['冲刺', '击打', '刀', '刺出', '剑', '命绝', '战士', '战斗', '作战', '打击', '打斗', '抵挡', '挥舞', '攻击', '杀意', '枪', '格挡', '武器', '潜行', '炮', '猛击', '盔甲', '绝命', '遇袭', '重击', '铠甲', '锤击', '防具', '防御'], 'any'))
		result.in_fight = true

	if (match_keys(args, ['"age":', '"name":', 'Always rememer', 'Alwaysrememer', 'Block>', 'Blocks>', 'Reply Format:', 'ReplyFormat:', 'Rule:', 'START>', 'age:', 'background>', 'character:', 'example>', 'examples>', 'keep the format', 'keeptheformat', 'name:', 'output as', 'output should', 'outputas', 'outputshould', 'request>', 'requests>', 'system:', 'the reply', 'thereply', 'thinking>', 'your reply', 'yourreply', '不是一个特定的角色', '将扮演'], 'any'))
		result.prompt_input = true

	return result
}
