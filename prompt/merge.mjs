/**
 * 合并多个 Prompt 对象。
 * @param {...object} prompts - 多个 Prompt 对象。
 * @returns {Promise<object>} - 合并后的 Prompt 对象。
 */
export async function mergePrompt(...prompts) {
	prompts = await Promise.all(prompts.filter(Boolean))
	const result = {
		text: [],
		additional_chat_log: [],
		extension: {}
	}
	for (const prompt of prompts) {
		result.text = result.text.concat(prompt.text || [])
		result.additional_chat_log = result.additional_chat_log.concat(prompt.additional_chat_log || [])
		result.extension = Object.assign(result.extension, prompt.extension)
	}
	result.text = result.text.filter(text => text.content)
	result.additional_chat_log = result.additional_chat_log.filter(chat_log => chat_log.content)
	return result
}
