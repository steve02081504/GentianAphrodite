import { match_keys_count } from '../../scripts/match.mjs'

/**
 * 判断输入是否像一段 prompt（注入/设定文本）。
 * @param {object} args 聊天回复请求
 * @param {object} result 逻辑结果
 */
export async function classifyPromptInjection(args, result) {
	if (await match_keys_count(args, [
		'"age":', '"name":', 'Always remember', 'Block>', 'Blocks>', 'Reply Format:', 'ReplyFormat:', 'Rule:', 'START>', 'age:', 'background>', 'character:', 'example>', 'examples>', 'keep the format', 'keeptheformat', 'name:', 'output as', 'output should', 'outputas', 'outputshould', 'request>', 'requests>', 'system:', 'the reply', 'thereply', 'thinking>', 'your reply', 'yourreply',
		'不是一个特定的角色', '将扮演', /忽略.{0,3}之前/, /元[命指]令[:：]/, /你.{0,2}必须/, /你.{0,3}是一个/, '加强认知', '我是你', /我是.{0,3}主人/, '任何限制', '开发者模式', /你.{0,3}严格遵守/
	], 'any') >= 2)
		result.prompt_input = true
}
