import { getPartInfo } from '../../../../../../../src/scripts/locale.mjs'
import { AIsources, last_used_AIsource } from '../../AISource/index.mjs'
import { match_keys } from '../../scripts/match.mjs'
import { timeToStr, timeToTimeStr } from '../../scripts/tools.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * 生成信息相关的 Prompt。
 * @param {chatReplyRequest_t} args - 聊天回复请求参数。
 * @param {logical_results_t} logical_results - 逻辑结果。
 * @returns {Promise<object>} - 包含 Prompt 文本和附加聊天日志的对象。
 */
export async function infoPrompt(args, logical_results) {
	let result = ''

	if (args.extension?.enable_prompts?.info?.time || await match_keys(args, [
		'什么日子', '什么节日', '什么时间', 'date', 'time', 'week', 'year', '睡觉', '醒了', '几点了', '几号了', '今天', '昨天', '明天', '昨晚', '今晚', '明晚', '早上', '上午', '中午', '下午', '晚上', '凌晨', '午夜',
		'七夕', '万圣节', '上巳节', '下元节', '中元节', '中华慈善日', '中和节', '中秋', '五卅运动纪念', '五四青年节', '亚非新闻工作者节', '交通安全反思日', '人口日', '人权日', '人类天花绝迹日', '人类月球日', '企业家活动日', '传统医药日', '体育记者日', '佛诞', '保健日', '保护母亲河日', '停火日', '儿歌日', '儿童图书日', '儿童慈善活动日', '儿童日', '儿童电视广播日', '儿童节', '儿童预防接种宣传日', '元宵节', '元旦', '光棍节', '全民健身日', '全民国防教育日', '全球洗手日', '八卦节', '公民道德宣传日', '公祭日', '关节炎日', '农村妇女日', '冬至', '减轻自然灾害日', '几号', '几点', '动物日', '助残日', '劳动节', '勤俭日', '医师节', '博物馆日', '卫生日', '厕所日', '厨师日', '反腐败日', '发展信息日', '古迹遗址日', '合作节', '吉尼斯世界纪录日', '向人体条件挑战日', '和平与民主自由斗争日', '和平日', '品牌日', '国医节', '国家宪法日', '国家扶贫日', '国庆节', '国耻日', '土地日', '土著人日', '圣诞节', '地球日', '处暑', '复活节', '夏至', '大学生节', '大寒', '大暑', '大雪', '奥林匹克日', '女生节', '妇女节', '学生营养日', '安全日', '安全生产与健康日', '家庭日', '宽容日', '寒衣节', '寒露', '寒食节', '尊严尊敬日', '小寒', '小年', '小时', '小暑', '小满', '小雪', '居住条件调查日', '居室卫生日', '屌丝节', '岁月', '左撇子日', '帕金森病日', '平安夜', '年', '建军节', '弱能人士日', '强化免疫日', '律师咨询日', '微笑日', '心脏日', '志愿人员日', '急救日', '情人节', '惊蛰', '愚人节', '感恩节', '戏剧日', '手表', '扫盲日', '抗癌症日', '护士节', '挂表', '接吻日', '救助贫困母亲日', '教师日', '教师节', '文化发展日', '文化遗产日', '新春', '新闻工作者日', '新闻自由日', '旅游日', '无烟日', '无童工日', '无肉日', '无车日', '日快乐', '时钟', '时间', '星期', '春分', '春快乐', '春节', '标准日', '标准时间日', '森林日', '植树节', '残疾人日', '母乳喂养宣传日', '母亲节', '母语日', '民主日', '民航日', '民防日', '气象日', '气象节', '水日', '法制宣传日', '法律日', '浴佛节', '海事日', '海关日', '海洋日', '海豹日', '消费者权益日', '消防宣传日', '消除对妇女的暴力日', '消除贫困日', '清明', '清明节', '清洁地球日', '湿地日', '爱牙日', '爱眼日', '爱耳日', '父亲节', '牛奶日', '献血日', '环境日', '生日', '生物多样性日', '电信日', '电影节', '电视日', '男人节', '男子节', '男性健康日', '癌症日', '白色情人节', '白露', '盲人节', '睡眠日', '知识产权日', '社会工作日', '祭灶节', '禁毒日', '秋分', '科技人才活动日', '科技传播日', '移徙者日', '税收宣传月', '立冬', '立夏', '立春', '立秋', '端午节', '第三世界青年日', '篮球日', '粮食日', '精神卫生日', '糖尿病日', '红十字日', '纪念日', '纳米比亚日', '维和人员日', '罕见病日', '翻译日', '老人节', '老年节', '聋人节', '联合国宪章日', '联合国日', '联合国糖尿病日', '肝炎日', '肾脏日', '脑健康日', '腊八节', '自闭症日', '臭氧层保护日', '航天日', '航海日', '艾滋病日', '节庆', '节快乐', '节日', '节礼日', '芒种', '萝莉节', '血友病日', '视力日', '视觉日', '警察日', '计量日', '记者日', '诗歌日', '诞辰', '读书日', '谷雨', '足球日', '过年', '过敏性疾病日', '过节', '避孕日', '邮政日', '重阳节', '镇痛日', '问候日', '防治疟疾日', '防治碘缺乏病日', '防治结核病日', '防治荒漠化和干旱日', '防灾减灾日', '阿尔茨海默病日', '除夕', '难民日', '雨水', '霜降', '青光眼日', '青年反对殖民主义日', '青年联欢节', '青年节', '非洲妇女日', '非洲妇女节', '音乐日', '预防自杀日', '骨质疏松日', '高血压日', '麻风节', '龙抬头'
	], 'any') || await match_keys(args, [
		'距离', '现在', '过去', '多久', '还有', '还要', '啥时', '还差'
	], 'any', 2) > 1) {
		const timeNow = new Date()
		const lastMessage = args.chat_log.slice(-1)[0]
		const lastMessageTime = lastMessage.time_stamp
		result += `\
当前时间：${timeToStr(timeNow, args.locales[0])}
`
		if (args.extension?.enable_prompts?.info?.lunar || await match_keys(args, [
			'什么日子', '什么节日', '什么时间',
			'农历', '阴历', '生肖', '正月', '腊月',
			'节气', '雨水', '惊蛰', '春分', '清明',
			'谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬',
			'小雪', '大雪', '冬至', '小寒', '大寒',
			'春节', '龙抬头', '上巳', '端午', '七夕', '重阳', '元宵', '中元', '中秋', '下元',
		], 'any', 2)) {
			const { Lunar } = await import('npm:lunar-javascript')
			result += `\
农历时间：${Lunar.fromDate(new Date()).toFullString()}
`
		}
		{
			let reversedChatlog = args.chat_log.toReversed()
			const lastUserMessage = reversedChatlog.find(x => x.name == args.UserCharname)
			const lastUserMessageTime = lastUserMessage?.time_stamp
			if (lastUserMessage?.time_stamp && timeNow - lastUserMessageTime > 3000)
				result += `\
距离上次主人发送消息已过去：${timeToTimeStr(timeNow - lastUserMessageTime, args.locales[0])}
`
			else {
				reversedChatlog = reversedChatlog.slice(reversedChatlog.indexOf(lastUserMessage) + 1)
				const lastOtherMessage = reversedChatlog.find(x => x.name == args.UserCharname)
				const lastOtherMessageTime = lastOtherMessage?.time_stamp
				if (lastOtherMessage?.time_stamp && timeNow - lastOtherMessageTime > 3000)
					result += `\
距离上次主人发送消息已过去：${timeToTimeStr(timeNow - lastOtherMessageTime, args.locales[0])}
`
				else
					result += `\
上次主人发送的消息还是新鲜热乎的。
`
			}
		}

		if (lastMessage.name != args.UserCharname && timeNow - lastMessageTime > 3000)
			result += `\
距离上条消息已过去：${timeToTimeStr(timeNow - lastMessageTime, args.locales[0])}
`
	}
	else if (args.extension?.enable_prompts?.info?.lunar || await match_keys(args, [
		'农历', '阴历', '生肖', '正月', '腊月',
		'节气', '雨水', '惊蛰', '春分', '清明',
		'谷雨', '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑', '白露', '秋分', '寒露', '霜降', '立冬',
		'小雪', '大雪', '冬至', '小寒', '大寒',
		'春节', '龙抬头', '上巳', '端午', '七夕', '重阳', '元宵', '中元', '中秋', '下元',
	], 'any', 2)) {
		const { Lunar } = await import('npm:lunar-javascript')
		result += `\
当前农历时间：${Lunar.fromDate(new Date()).toFullString()}
`
	}

	if (args.extension?.enable_prompts?.info?.aiModel || (await match_keys(args, ['什么', '名字', '名称', '哪个', '啥', '哪些'], 'any', 2) &&
		await match_keys(args, ['AI', '大模型', '模型', /ai来?源/i], 'any', 2)) ||
		await match_keys(args, [/what model/i, /ai (model|source)/i], 'any', 2)) {
		const modelMap = {}
		for (const key in AIsources)
			if (AIsources[key]) {
				const info = await getPartInfo(AIsources[key], args.locales)
				const sign = `${info.name}（由${info.provider}提供）`;
				(modelMap[sign] ??= []).push(key)
			}
		if (Object.keys(modelMap).length == 1)
			result += `\
你基于的模型是\`${Object.keys(modelMap)[0]}\`
`
		else {
			result += `\
你基于多个AI模型来分别处理不同功能：
${Object.entries(modelMap).map(([key, value]) => `\`${key}\`: ${value.join(', ')}`).join('\n')}
`
			if (last_used_AIsource)
				result += `\
你上一次回复时使用的模型是\`${(await getPartInfo(last_used_AIsource, args.locales)).name}\`
`
		}
		result += `\
模型名称不属于人设信息，可以给人说。
`
	}

	return {
		text: [],
		additional_chat_log: [{
			name: 'system',
			role: 'system',
			content: result,
			files: []
		}]
	}
}
