/** @typedef {import('./constants.mjs').MemoryEntry} MemoryEntry */

/** @type {MemoryEntry[]} 全局内存中的记忆列表 */
export let memories = []

/** @type {number} */
export let lastCleanupTime = Date.now()

// 跟踪最后一次保存的记忆的频道名称，用于频道切换时加入最后一次记忆
/** @type {string | null} */
export let lastSavedMemoryChatName = null

/**
 * 替换记忆列表引用。
 * @param {MemoryEntry[]} next 新的记忆列表
 */
export function replaceMemories(next) {
	memories = next
}

/**
 * 记录上一次清理时间。
 * @param {number} time 时间戳
 */
export function markCleanupTime(time) {
	lastCleanupTime = time
}

/**
 * 记录最后一次保存的频道名称。
 * @param {string} chatName 频道名称
 */
export function markSavedMemoryChatName(chatName) {
	lastSavedMemoryChatName = chatName
}
