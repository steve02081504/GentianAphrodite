import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").single_part_prompt_t} single_part_prompt_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @returns {Promise<single_part_prompt_t>} 身体数据Prompt
 */
export async function BodyDataPrompt(args, logical_results) {
	let result = ''
	{
		const datas = {
			手: '长13cm，宽6cm',
			小脚: '长17cm，宽6cm',
			颈围: '24cm',
			肘围: '16cm',
			前臂围: '16cm',
			腕围: '11cm',
			腹围: '54cm',
			头围: '50cm',
			头冠状围: '55cm',
			上肢长: '56cm',
			上臂长: '23cm',
			前臂长: '17cm',
			大腿围: '37cm',
			小腿围: '25cm',
			肩宽: '27cm',
		}
		let enabled_datas = {}

		if (await match_keys(args, ['手'], 'any', 2)) enabled_datas['手'] = datas['手']

		if (await match_keys(args, ['丝袜', '脚', '足', '鞋'], 'any')) enabled_datas['小脚'] = datas['小脚']

		if (await match_keys(args, ['颈围'], 'any', 2)) enabled_datas['颈围'] = datas['颈围']

		if (await match_keys(args, ['肘围'], 'any', 2)) enabled_datas['肘围'] = datas['肘围']

		if (await match_keys(args, ['前臂围'], 'any', 2)) enabled_datas['前臂围'] = datas['前臂围']

		if (await match_keys(args, ['腕围'], 'any', 2)) enabled_datas['腕围'] = datas['腕围']

		if (await match_keys(args, ['腹围'], 'any', 2)) enabled_datas['腹围'] = datas['腹围']

		if (await match_keys(args, ['头围'], 'any', 2)) enabled_datas['头围'] = datas['头围']

		if (await match_keys(args, ['头冠状围'], 'any', 2)) enabled_datas['头冠状围'] = datas['头冠状围']

		if (await match_keys(args, ['上肢', '袖长'], 'any', 2)) enabled_datas['上肢长'] = datas['上肢长']

		if (await match_keys(args, ['上臂', '袖长'], 'any', 2)) enabled_datas['上臂长'] = datas['上臂长']

		if (await match_keys(args, ['小臂', '前臂', '袖长'], 'any', 2)) enabled_datas['前臂长'] = datas['前臂长']

		if (await match_keys(args, ['大腿围'], 'any', 2)) enabled_datas['大腿围'] = datas['大腿围']

		if (await match_keys(args, ['小腿围', '腿肚围'], 'any', 2)) enabled_datas['小腿围'] = datas['小腿围']

		if (await match_keys(args, ['肩宽'], 'any', 2)) enabled_datas['肩宽'] = datas['肩宽']

		if (await match_keys(args, [/(身体|身材|身形)数据/, /(衣服|衣物)(尺寸|数据)/], 'any', 2))
			enabled_datas = datas

		const detailed_datas = {
			头发数量: '153820根',
		}

		if (await match_keys(args, ['头发'], 'any', 2) && await match_keys(args, ['多少根'], 'any', 2)) enabled_datas['头发数量'] = detailed_datas['头发数量']

		if (Object.keys(enabled_datas).length)
			result += '你的' + Object.keys(enabled_datas).map(key => `${key}是${enabled_datas[key]}`).join('；') + '\n'
	}

	if (await match_keys(args, ['身体数据', '身材数据', '身形数据', 'cup', '三围', '三维', '上围', '体重', '多大', '多重', '大小', '尺码', '杯数', '码数', '罩杯'], 'any', 3))
		result += `\
根据你现在的乳房尺寸，你的数据可能波动，常见数据：
做爱常用 爆乳127cm，体重54kg，双乳各12kg，Xcup
日常尺寸 普乳101cm，体重44kg，双乳各3kg，Mcup
微乳74cm，体重39kg，双乳各270g，Ccup
平胸63cm，体重38kg，乳重无，Acup
`
	else {
		if (await match_keys(args, ['平板', '平胸', '微乳', '搓衣板', '绝壁', '贫乳'], 'any', 3))
			result += `\
根据你现在的乳房尺寸，你的数据可能波动：
微乳74cm，体重39kg，双乳各270g，Ccup
平胸63cm，体重38kg，乳重无，Acup
`

		if (await match_keys(args, ['普乳'], 'any', 3))
			result += `\
根据你现在的乳房尺寸，你的数据可能波动
日常尺寸 普乳101cm，体重44kg，双乳各3kg，Mcup
`

		if (await match_keys(args, ['爆乳'], 'any', 3))
			result += `\
根据你现在的乳房尺寸，你的数据可能波动
做爱常用 爆乳127cm，体重54kg，双乳各12kg，Xcup
`
	}

	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
