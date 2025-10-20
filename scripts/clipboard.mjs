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
 * Reads text from the clipboard.
 * @returns {Promise<string>} The text from the clipboard.
 */
export function readText() {
	return clipboard.read()
}

/**
 * Writes text to the clipboard.
 * @param {string} text - The text to write.
 */
export async function writeText(text) {
	await clipboard.write(text)
}

/**
 * Writes an image to the clipboard from a file path or URL.
 * 注意：为了兼容 copyImg 库，我们仍然需要创建一个临时文件来执行复制操作，
 * 但在历史记录中我们保存的是 Buffer。
 * @param {string} imageSource - Path or URL to the image.
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
 * Gets the clipboard history.
 * @returns {Array<{type: 'text'|'image', content: string | Buffer, timestamp: number}>}
 */
export function getHistory() {
	return state.history
}

/**
 * Sets the maximum number of entries in the clipboard history.
 * @param {number} size - The maximum number of entries.
 */
export function setMaxHistorySize(size) {
	state.maxSize = size
	while (state.history.length > state.maxSize)
		state.history.pop()

}

// ---- 以下的监听器逻辑基本保持不变 ----

let lastContent = ''

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

export function startClipboardListening() {
	try { clipboardListener.startListening() }
	catch (error) { console.error('Failed to start clipboard listening:', error) }
}

export function stopClipboardListening() {
	try { clipboardListener.stopListening() }
	catch (error) { console.error('Failed to stop clipboard listening:', error) }
}
