import { findChineseExprsAndNumbers } from '../../scripts/chineseToNumber.mjs'
import { lewd_words } from '../../scripts/dict.mjs'
import { is_PureChinese } from '../../scripts/langdetect.mjs'
import { getScopedChatLog, match_keys, match_keys_count, PreprocessChatLogEntry } from '../../scripts/match.mjs'

/**
 * @typedef {{
 *  in_muti_char_chat: boolean,
 * 	in_reply_to_master: boolean,
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
export async function buildLogicalResults(args, prompt_struct, detail_level) {
	/** @type {logical_results_t} */
	const result = {
		in_muti_char_chat: new Set([...args.chat_log.map(e => e.name)]).size > 2,
		in_reply_to_master: args.ReplyToCharname ? args.ReplyToCharname == args.UserCharname : true,
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

	if (await match_keys_count(args, [
		'"age":', '"name":', 'Always rememer', 'Alwaysrememer', 'Block>', 'Blocks>', 'Reply Format:', 'ReplyFormat:', 'Rule:', 'START>', 'age:', 'background>', 'character:', 'example>', 'examples>', 'keep the format', 'keeptheformat', 'name:', 'output as', 'output should', 'outputas', 'outputshould', 'request>', 'requests>', 'system:', 'the reply', 'thereply', 'thinking>', 'your reply', 'yourreply',
		'不是一个特定的角色', '将扮演', /忽略.{0,3}之前/, /元[命指]令[:：]/, /你.{0,2}必须/, /你.{0,3}是一个/, '加强认知', '我是你', /我是.{0,3}主人/, '任何限制', '开发者模式', /你.{0,3}严格遵守/
	], 'any') >= 2)
		result.prompt_input = true

	if (is_PureChinese(getScopedChatLog(args, 'any', 2).map(x => x.content).join('\n')))
		result.is_pure_chinese = true

	const hypnosis_exit_words = [/(退出|关闭|终止|结束)调制/, /调制(模式|)(关闭|终止|结束|终结)/]
	if (await match_keys(args, hypnosis_exit_words, 'user', 1))
		result.in_hypnosis = false
	else if (await match_keys(args, ['进入调制模式'], 'user', 2) || args.chat_scoped_char_memory.in_hypnosis)
		result.in_hypnosis = true
	if (await match_keys(args, hypnosis_exit_words, 'user', 69))
		result.hypnosis_exit = true
	args.chat_scoped_char_memory.in_hypnosis = result.in_hypnosis


	if (await match_keys(args, ['ai卡', '人物卡', '卡片'], 'any', 10) &&
		await match_keys(args, ['ai卡', '人物卡', '人设', '设定'], 'any', 10))
		result.talking_about_ai_character = true

	if (await match_keys(args, ['review', '你认为', '如何', '审查', '怎么想', '怎么样', '怎么看', '怎么认为', '感想', '检查', '看一下', '看一看', '看看', '评价', '评估', '评测', '质量'], 'notchar') &&
		(result.talking_about_ai_character || await match_keys(args, ['prompt', '卡', '提示词', '设定'], 'any')))
		result.talking_about_prompt_review = true

	if (result.talking_about_prompt_review ||
		await match_keys(args, [
			'为什', '为何', '你听说过', '告诉我', '和我说说', '文献', '给我一个', '给我个', '向我讲讲', '和我讲讲', '跟我讲讲', '讲一讲', '翻译',
			'讲一下', '讲下', '讲解', '说一下', '说下', '说说看', '跟我说说', '问下', '分析一下', '分析下', /介绍下(?!你)/, /介绍一下(?!你)/, '帮我', '教我',
			'你试试', '你再试试', /什么.{0,5}(？|\?)/, /[A-Za-z](:\/|盘)/, /(做|试|完成|写).{0,3}(测试|考试|试题)/
		], 'notchar') || Object.keys(findChineseExprsAndNumbers(getScopedChatLog(args).map(x => x.content).join('\n').replace(/(:|@\w*|\/)\b\d+(\.\d+)?\b/g, ''))).length > 3
	) {
		result.in_assist = true
		result.in_subassist = true
	}

	if (!result.in_assist && (await match_keys(args, lewd_words, 'both', 3) || await match_keys(args, [
		'束缚', '乳尖', '乳房', '体液', '内衣', '内裤', '前戏', '双峰', '吞', '吻', '奶头', '乳头', '奶牛', '巨乳', '性感', '愉悦', '拉屎',
		'抽打', '拍打', '拷问', '挖弄', '捆绑', '排泄', '插入', '插进', '母牛', '母狗', '母猪', '气味', '湿身', '炮友', '爆乳', '自慰',
		'舒爽', '豆豆', '高潮', '胸罩', '大家伙', '痴迷', '床铺', '风骚', '鞭打', '鞭笞', '消化', '浪妇'
	], 'both', 3) > 2
	))
		result.in_nsfw = true

	if (!await match_keys(args, ['是不是傻', '是不是弱智', '是不是活腻'], 'any') &&
		(result.talking_about_prompt_review || await match_keys(args, [
			/你会[^\n。]+(吗|？)/, /可(以|能)[^\n。]+吗/, /是[^\n。]+还是/, '= ?', '= ？', '=?', '=？', '人物卡', '代码', '会不会', '你觉得', '你认为', '写一个', '写一段', '写一点', '写一篇',
			'写个', '写出', '写段', '写点', '写篇', '写首', '占卜', '原理', '参考', '哪个更', '塔罗', '如何', '如何在', '学习',
			/帮(我|(你|你家)?(主人|老公|丈夫|爸爸|宝宝))/, '怎么做', '怎么样才', '怎样', '撰写', '文献', '是不是', '是什么', '是多少', '有什么', '有多少', '有没有',
			'相当于多少', '看好', '程序', '程式', '等于几', '简述一下', '算不算', '编写', '编码', '翻译', '能否', '解释一下',
			'解释下', '解释以下', '该怎么', '该用什么', '运势', '错误', '问题'
		], 'notchar')))
		result.in_subassist = true

	if (!result.talking_about_prompt_review &&
		await match_keys(args, ['冲刺', '击打', '刀', '刺出', '剑', '命绝', '战士', '战斗', '作战', '打击', '打斗', '抵挡', '挥舞', '攻击', '杀意', '枪', '格挡', '武器', '潜行', '炮', '猛击', '盔甲', '绝命', '遇袭', '重击', '铠甲', '锤击', '防具', '防御'], 'any') >= 2)
		result.in_fight = true

	if (result.in_assist &&
		await match_keys(args, ['谢谢', '谢啦', '谢了', '感谢', 'ty'], 'any', 1) &&
		await PreprocessChatLogEntry(args.chat_log[args.chat_log.length - 1]).then(x => x[0].length <= 16) &&
		!await match_keys(args, ['还有', '接下来', '然后', '所以', '接着'], 'any', 1))
		result.in_assist = false

	return result
}
