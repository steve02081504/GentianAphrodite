import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import clipboardListener from 'npm:clipboard-event'
import clipboard from 'npm:clipboardy'
import { copyImg } from 'npm:img-clipboard'

import { toFileObj } from './fileobj.mjs'


const state = {
	history: [],
	maxSize: 50,
}

/**
 * 将条目添加到剪贴板历史记录中。
 * @param {{type: 'text'|'image', content: string | Buffer, timestamp: number}} entry - 要添加的条目。
 */
function addToHistory(entry) {
	if (state.history.length) {
		const lastEntry = state.history[0]
		if (lastEntry.type === entry.type) {
			if (entry.type === 'text' && lastEntry.content === entry.content)
				return

			if (entry.type === 'image' && lastEntry.content.equals(entry.content))
				return
		}
	}

	state.history.unshift(entry)

	if (state.history.length > state.maxSize)
		state.history.pop()

}

/**
 * 从剪贴板读取文本内容。
 * @returns {Promise<string>} - 返回剪贴板中的文本。
 */
export function readText() {
	return clipboard.read()
}

/**
 * 将文本写入剪贴板。
 * @param {string} text - 要写入的文本。
 * @returns {Promise<void>}
 */
export async function writeText(text) {
	await clipboard.write(text)
}

/**
 * 从文件路径或 URL 读取图片，并将其写入剪贴板。
 * 注意：此函数会创建一个临时文件来完成复制操作。
 * @param {string} imageSource - 图片的文件路径或 URL。
 * @returns {Promise<void>}
 */
export async function writeImage(imageSource) {
	const fileObj = await toFileObj(imageSource)

	const tempDir = path.join(os.tmpdir(), 'clipboard-temp')
	await fs.mkdir(tempDir, { recursive: true })
	const tempPath = path.join(tempDir, fileObj.name)
	await fs.writeFile(tempPath, fileObj.buffer)

	await copyImg(tempPath)

	addToHistory({ type: 'image', content: fileObj.buffer, timestamp: Date.now() })
}

/**
 * 获取剪贴板的历史记录。
 * @returns {Array<{type: 'text'|'image', content: string | Buffer, timestamp: number}>} - 一个包含历史记录条目的数组。
 */
export function getHistory() {
	return state.history
}

/**
 * 设置剪贴板历史记录的最大条目数。
 * @param {number} size - 新的最大条目数。
 */
export function setMaxHistorySize(size) {
	state.maxSize = size
	while (state.history.length > state.maxSize)
		state.history.pop()

}

// ---- 以下的监听器逻辑基本保持不变 ----

let lastContent = ''

/**
 * 剪贴板变化事件的回调函数。
 */
async function onClipboardChange() {
	try {
		const content = await clipboard.read()
		if (content && content !== lastContent) {
			lastContent = content
			addToHistory({ type: 'text', content, timestamp: Date.now() })
		}
	}
	catch (error) {
		lastContent = '' // 如果剪贴板内容不是文本，则重置
	}
}

clipboardListener.on('change', onClipboardChange)

/**
 * 开始监听剪贴板的变化。
 */
export function startClipboardListening() {
	try {
		if (process.platform === 'linux' && !process.env.DISPLAY)
			throw new Error('Cannot start clipboard listening: No DISPLAY environment variable.')
		clipboardListener.startListening()
	}
	catch (error) { console.error('Failed to start clipboard listening:', error) }
}

/**
 * 停止监听剪贴板的变化。
 */
export function stopClipboardListening() {
	try { clipboardListener.stopListening() }
	catch (error) { console.error('Failed to stop clipboard listening:', error) }
}
