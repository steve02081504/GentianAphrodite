import { Buffer } from 'node:buffer'

/**
 * 合并聊天记录条目。
 * @param {object[]} logEntries 待合并的聊天记录条目数组
 * @param {number} mergeMessagePeriodMs 合并消息的时间窗口（毫秒）
 * @returns {object[]} 合并后的聊天记录条目数组
 */
export function mergeChatLogEntries(logEntries, mergeMessagePeriodMs) {
	if (!logEntries?.length) return []
	const newLog = []
	let lastEntry = {
		...logEntries[0],
		extension: {
			...logEntries[0].extension,
			platform_message_ids: [...logEntries[0].extension?.platform_message_ids || []],
		},
	}

	for (let i = 1; i < logEntries.length; i++) {
		const currentEntry = logEntries[i]
		if (
			lastEntry.name === currentEntry.name &&
			currentEntry.time_stamp - lastEntry.time_stamp < mergeMessagePeriodMs &&
			!lastEntry.files?.length
		) {
			lastEntry.content += '\n' + currentEntry.content
			lastEntry.files = currentEntry.files
			lastEntry.time_stamp = currentEntry.time_stamp
			lastEntry.extension = {
				...lastEntry.extension,
				...currentEntry.extension,
				platform_message_ids: Array.from(new Set([
					...lastEntry.extension?.platform_message_ids || [],
					...currentEntry.extension?.platform_message_ids || [],
				])),
			}
		}
		else {
			newLog.push(lastEntry)
			lastEntry = {
				...currentEntry,
				extension: {
					...currentEntry.extension,
					platform_message_ids: [...currentEntry.extension?.platform_message_ids || []],
				},
			}
		}
	}
	newLog.push(lastEntry)
	return newLog
}

/**
 * @param {string} str 待检查字符串
 * @returns {boolean} 是否形似 bot 命令
 */
export function isBotCommand(str) {
	return Boolean(String(str || '').match(/^[!$%&/\\！]/))
}

/**
 * @param {Array<Function | unknown>} files 文件或 lazy 工厂
 * @returns {Promise<unknown[]>} 已解析的文件
 */
export async function fetchFiles(files) {
	const settled = await Promise.allSettled(
		(files || []).map(file => typeof file === 'function' ? file() : file),
	)
	return settled.filter(row => row.status === 'fulfilled' && row.value).map(row => row.value)
}

/**
 * @param {object[]} messages 消息数组
 * @returns {Promise<object[]>} 原数组（files 已就地解析）
 */
export async function fetchFilesForMessages(messages) {
	for (const message of messages || [])
		if (message.files) message.files = await fetchFiles(message.files)
	return messages
}

/**
 * @param {object} row chat_log 行
 * @returns {string} 纯文本内容
 */
export function rowTextContent(row) {
	const raw = row?.content
	if (typeof raw === 'string') return raw
	if (raw?.content != null) return String(raw.content)
	return String(raw ?? '')
}

/**
 * @param {object} row chat_log 行
 * @returns {string} 作者 entityHash（小写）
 */
export function rowAuthorHash(row) {
	const bridge = row?.extension?.bridge
	return String(
		bridge?.authorEntityHash || row.extension?.authorEntityHash || row.sender || '',
	).toLowerCase()
}

/**
 * @param {object} row chat_log 行
 * @param {string} selfHash 自身 entityHash
 * @returns {boolean} 是否自己发的
 */
export function rowIsFromSelf(row, selfHash) {
	return !!(row.charId || row.content?.role === 'char' || rowAuthorHash(row) === selfHash)
}

/**
 * @param {object[]} files 文件列表
 * @returns {string} 文件字节 hex 摘要
 */
export function summaryFilesHex(files) {
	return (files || [])
		.filter(file => !file.extension?.is_from_vision)
		.map(file => file.buffer instanceof Buffer ? file.buffer.toString('hex') : String(file.buffer || ''))
		.join('\n')
}
