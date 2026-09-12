import { findChineseExprsAndNumbers } from '../../scripts/chinese-to-number.mjs'
import { getScopedChatLog, match_keys, PreprocessChatLogEntry } from '../../scripts/match.mjs'

/**
 * 判断是否需要进入 「辅助/子辅助」 模式。
 * @param {object} args 聊天回复请求
 * @param {object} result 逻辑结果
 */
export async function classifyAssistIntent(args, result) {
	if (result.talking_about_prompt_review ||
		await match_keys(args, [
			'为什', '为何', '你听说过', '告诉我', '和我说说', '文献', '给我一个', '给我个', '向我讲讲', '和我讲讲', '跟我讲讲', '讲一讲', '翻译',
			'讲一下', '讲下', '讲解', '说一下', '说下', '说说看', '跟我说说', '问下', '分析一下', '分析下', /介绍下(?!你)/, /介绍一下(?!你)/, '帮我', '教我',
			'你试试', '你再试试', /什么.{0,5}(？|\?)/, /[A-Za-z](:\/|盘)/, /(做|试|完成|写).{0,3}(测试|考试|试题)/, '考考你'
		], 'notchar') || Object.keys(findChineseExprsAndNumbers(getScopedChatLog(args).map(x => x.content).join('\n').replace(/(:|@\w*|\/)\b\d+(?:\.\d+)?\b/g, ''))).length > 3
	) {
		result.in_assist = true
		result.in_subassist = true
	}
}

/**
 * 单独判断是否需要 「子辅助」 模式。
 * @param {object} args 聊天回复请求
 * @param {object} result 逻辑结果
 */
export async function classifySubassist(args, result) {
	if (!await match_keys(args, ['是不是傻', '是不是弱智', '是不是活腻'], 'any') &&
		(result.talking_about_prompt_review || await match_keys(args, [
			/你会[^\n。]+(吗|？)/, /可(以|能)[^\n。]+吗/, /是[^\n。]+还是/, '= ?', '= ？', '=?', '=？', '人物卡', '代码', '会不会', '你觉得', '你认为', '写一个', '写一段', '写一点', '写一篇',
			'写个', '写出', '写段', '写点', '写篇', '写首', '占卜', '原理', '参考', '哪个更', '塔罗', '如何', '如何在', '学习',
			/帮(我|(你|你家)?(主人|老公|丈夫|爸爸|宝宝))/, '怎么做', '怎么样才', '怎样', '撰写', '文献', '是不是', '是什么', '是多少', '有什么', '有多少', '有没有',
			'相当于多少', '看好', '程序', '程式', '等于几', '简述一下', '算不算', '编写', '编码', '翻译', '能否', '解释一下',
			'解释下', '解释以下', '该怎么', '该用什么', '运势', '错误', '问题'
		], 'notchar')))
		result.in_subassist = true
}

/**
 * 简短道谢时退出辅助模式。
 * @param {object} args 聊天回复请求
 * @param {object} result 逻辑结果
 */
export async function refineAssist(args, result) {
	if (result.in_assist &&
		await match_keys(args, ['谢谢', '谢啦', '谢了', '感谢', 'ty'], 'any', 1) &&
		await PreprocessChatLogEntry(args.chat_log[args.chat_log.length - 1]).then(x => x[0].length <= 16) &&
		!await match_keys(args, ['还有', '接下来', '然后', '所以', '接着'], 'any', 1))
		result.in_assist = false
}
