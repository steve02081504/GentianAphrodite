// This file will contain utility functions for prompts.

export function margePrompt(...prompts) {
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
