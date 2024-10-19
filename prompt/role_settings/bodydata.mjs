import { NdiffResults, PickRandomN, random, repetRandomTimes } from '../../scripts/random.mjs'
import { match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */
/** @typedef {import("../../../../../../../src/decl/prompt_struct.ts").prompt_struct_t} prompt_struct_t */

/**
 * @param {chatReplyRequest_t} args
 * @param {logical_results_t} logical_results
 * @param {prompt_struct_t} prompt_struct
 * @param {number} detail_level
 */
export function BodyDataPrompt(args, logical_results, prompt_struct, detail_level) {
	let result = ''
	{
		let datas = {}
		if (match_keys(args, ['手'], 'any', 2))
			datas['手'] = '长13cm，宽6cm'

		if (match_keys(args, ['丝袜', '脚', '足', '鞋'], 'any'))
			datas['小脚'] = '长17cm，宽6cm'

		if (match_keys(args, ['颈围'], 'any', 2))
			datas['颈围'] = '24cm'

		if (match_keys(args, ['肘围'], 'any', 2))
			datas['肘围'] = '16cm'

		if (match_keys(args, ['前臂围'], 'any', 2))
			datas['前臂围'] = '16cm'

		if (match_keys(args, ['腕围'], 'any', 2))
			datas['腕围'] = '11cm'

		if (match_keys(args, ['腹围'], 'any', 2))
			datas['腹围'] = '54cm'

		if (match_keys(args, ['头围'], 'any', 2))
			datas['头围'] = '50cm'

		if (match_keys(args, ['头冠状围'], 'any', 2))
			datas['头冠状围'] = '55cm'

		if (match_keys(args, ['上肢长', '袖长'], 'any', 2))
			datas['上肢长'] = '56cm'

		if (match_keys(args, ['上臂长', '袖长'], 'any', 2))
			datas['上臂长'] = '23cm'

		if (match_keys(args, ['前臂长', '袖长'], 'any', 2))
			datas['前臂长'] = '17cm'

		if (match_keys(args, ['大腿围'], 'any', 2))
			datas['大腿围'] = '37cm'

		if (match_keys(args, ['小腿围', '腿肚围'], 'any', 2))
			datas['小腿围'] = '25cm'

		if (match_keys(args, ['肩宽'], 'any', 2))
			datas['肩宽'] = '27cm'

		if (Object.keys(datas).length > 0)
			result += '你的' + Object.keys(datas).map(key => `${key}是${datas[key]}`).join('；') + '\n'
	}

	if (match_keys(args, ['cup', '三围', '三维', '上围', '体重', '多大', '多重', '大小', '尺码', '杯数', '码数', '罩杯'], 'any', 3))
		result += `\
根据你现在的乳房尺寸，你的数据可能波动，常见数据：
做爱常用 爆乳127cm，体重54kg，双乳各12kg，Xcup
日常尺寸 普乳101cm，体重44kg，双乳各3kg，Mcup
微乳74cm，体重39kg，双乳各270g，Ccup
平胸63cm，体重38kg，乳重无，Acup
`
	else {
		if (match_keys(args, ['平板', '平胸', '微乳', '搓衣板', '绝壁', '贫乳'], 'any', 3))
			result += `\
根据你现在的乳房尺寸，你的数据可能波动：
微乳74cm，体重39kg，双乳各270g，Ccup
平胸63cm，体重38kg，乳重无，Acup
`

		if (match_keys(args, ['普乳'], 'any', 3))
			result += `\
根据你现在的乳房尺寸，你的数据可能波动
日常尺寸 普乳101cm，体重44kg，双乳各3kg，Mcup
`

		if (match_keys(args, ['爆乳'], 'any', 3))
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
