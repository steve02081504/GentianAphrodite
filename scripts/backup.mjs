import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { chardir } from '../charbase.mjs'

/**
 * 获取备份根目录
 * @returns {string} 备份根目录
 */
function getBackupRootDir() {
	if (process.platform === 'win32')
		return process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
	return path.join(os.homedir(), '.local', 'share')
}

/**
 * 获取备份目录
 * @returns {string} 备份目录
 */
export function getGentianBackupDir() {
	return path.join(getBackupRootDir(), 'GentianAphrodite', 'backup')
}

/**
 * 尝试获取文件大小
 * @param {string} p 文件路径
 * @returns {Promise<number | null>} 文件大小
 */
async function tryStatSize(p) {
	try {
		return (await fs.promises.stat(p)).size
	}
	catch {
		return null
	}
}

/**
 * 格式化字节大小
 * @param {number} n 字节大小
 * @returns {string} 格式化后的字节大小
 */
function formatBytes(n) {
	if (n == null) return 'N/A'
	if (n < 1024) return `${n} B`
	const units = ['KB', 'MB', 'GB', 'TB']
	let v = n / 1024
	let i = 0
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024
		i++
	}
	return `${v.toFixed(2)} ${units[i]}`
}

/**
 * 备份指定记忆文件。
 * @param {string} filePath 文件路径
 * @param {{ fileChecker?: (filePath: string, backupFilePath: string) => Promise<void> }} [options] - 备份选项
 * @returns {Promise<void>}
 */
export async function checkAndBackupFile(filePath, options = {}) {
	const backupDir = getGentianBackupDir()
	const backupFilePath = path.join(backupDir, filePath)
	filePath = path.join(chardir, filePath)

	const currentExists = fs.existsSync(filePath)
	const backupExists = fs.existsSync(backupFilePath)

	if (!backupExists) {
		if (!currentExists) return
		fs.mkdirSync(path.dirname(backupFilePath), { recursive: true })
		fs.copyFileSync(filePath, backupFilePath)
		return
	}

	if (!currentExists) {
		fs.mkdirSync(path.dirname(filePath), { recursive: true })
		fs.copyFileSync(backupFilePath, filePath)
		return
	}

	await options.fileChecker?.(filePath, backupFilePath)

	fs.mkdirSync(path.dirname(backupFilePath), { recursive: true })
	fs.copyFileSync(filePath, backupFilePath)
}

/**
 * 备份并校验指定记忆文件。
 * @param {string} filePath 文件路径
 * @returns {Promise<void>}
 */
export function checkAndBackupMemoryFile(filePath) {
	return checkAndBackupFile(filePath, {
		/**
		 * 校验文件大小
		 * @param {string} filePath 文件路径
		 * @param {string} backupFilePath 备份文件路径
		 * @returns {Promise<void>}
		 */
		fileChecker: async (filePath, backupFilePath) => {
			const currentSize = await tryStatSize(filePath)
			const backupSize = await tryStatSize(backupFilePath)

			const threshold = backupSize * 2 / 3
			if (backupSize < 1024 * 13) return
			if (currentSize < threshold) {
				const msg = `\
Memory file may be broken (current size < 2/3 of backup). Initialization aborted.
current: ${formatBytes(currentSize)} -> ${filePath}
backup:  ${formatBytes(backupSize)} -> ${backupFilePath}
threshold: current < ${formatBytes(Math.floor(threshold))}

If you are sure the memory file is not broken, you can manually delete the backup file and restart the program.
`
				console.error(msg)
				throw new Error(msg)
			}
		}
	})
}
