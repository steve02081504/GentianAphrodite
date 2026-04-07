import { bigfloat } from 'npm:@steve02081504/bigfloat'
import { expression_dictionary_t } from 'npm:@steve02081504/number-alchemist'

import { getScopedChatLog, match_keys } from '../../scripts/match.mjs'
/** @typedef {import("../../../../../../../src/public/parts/shells/chat/decl/chatLog.ts").chatReplyRequest_t} chatReplyRequest_t */
/** @typedef {import("../logical_results/index.mjs").logical_results_t} logical_results_t */

/**
 * 数字炼金术提示函数
 * @param {chatReplyRequest_t} args 用户输入参数
 * @param {logical_results_t} logical_results 逻辑结果
 * @returns {Promise<prompt_struct_t>} 返回的提示结构
 */
export async function NumberAlchemistPrompt(args, logical_results) {
	let result = ''

	/**
	 * 获取聊天日志。
	 * @returns {string} - 聊天日志内容。
	 */
	const getLog = () => getScopedChatLog(args, 'any').map(x => x.content).join('\n')
	if (args.extension?.enable_prompts?.numberAlchemist || await match_keys(args, [/(用|从)\s*[\d.]+\s*(证明|论证)\s*[\d.]+/, /prove\s*[\d.]+\s*(with|by|from)\s*[\d.]+/i], 'any')) {
		const log = getLog()
		const pairMap = new Map()
		const cnMatches = log.matchAll(/(?:用|从)\s*(?<from>[\d.]+)\s*(?:证明|论证)\s*(?<to>[\d.]+)/g)
		const enMatches = log.matchAll(/prove\s*(?<from>[\d.]+)\s*(?:with|by|from)\s*(?<to>[\d.]+)/gi)
		for (const match of [...cnMatches, ...enMatches]) {
			if (!match?.groups?.from || !match?.groups?.to) continue
			const key = `${match.groups.from}->${match.groups.to}`
			if (!pairMap.has(key))
				pairMap.set(key, { from: match.groups.from, to: match.groups.to })
		}
		if (pairMap.size) {
			const proofs = []
			for (const { from, to } of pairMap.values()) {
				const basenum = bigfloat(from)
				const targetnum = bigfloat(to)
				const resultnum = await expression_dictionary_t(basenum)(targetnum)
				if (args.supported_functions?.markdown)
					proofs.push(`${targetnum} = \`${resultnum}\``)
				else
					proofs.push(`${targetnum} = ${resultnum}`)
			}
			result += `\
已注意到以下论证：
${proofs.join('\n')}
`
		}
	}
	return {
		text: [{
			content: result,
			important: 0
		}]
	}
}
