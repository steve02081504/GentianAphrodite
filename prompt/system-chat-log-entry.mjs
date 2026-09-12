/**
 * 构建一条系统角色的 additional_chat_log 条目。
 * @param {string} content 系统提示内容
 * @returns {{ name: string, uid: string, role: string, content: string, files: [] }} 系统日志条目
 */
export function systemChatLogEntry(content) {
	return {
		name: 'system',
		uid: 'system',
		role: 'system',
		content,
		files: []
	}
}
