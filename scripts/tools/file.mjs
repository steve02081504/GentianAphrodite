import fs from 'node:fs'

/**
 * 如果数据与现有数据不同，则同步将数据写入文件。
 * @param {string} filePath - 要写入的文件的路径。
 * @param {string|Buffer} data - 要写入文件的数据。
 * @param {string} [encoding='utf8'] - 写入文件时使用的编码。
 */
export function nicerWriteFileSync(filePath, data, encoding) {
	if (Object(data) instanceof String) encoding ??= 'utf8'
	let oldData
	if (fs.existsSync(filePath))
		oldData = fs.readFileSync(filePath, encoding)
	if (oldData != data)
		fs.writeFileSync(filePath, data, encoding)
}

/**
 * 递归地删除目录中的所有空目录。
 * @param {string} dirPath - 要清理的目录。
 * @returns {boolean} - 如果目录被成功清理，则返回 true，否则返回 false。
 */
export function clearEmptyDirs(dirPath) {
	const files = fs.readdirSync(dirPath, { recursive: true })
	let empty = true
	for (const file of files) {
		const filePath = dirPath + '/' + file
		if (fs.lstatSync(filePath).isDirectory() && clearEmptyDirs(filePath)) continue
		empty = false
	}
	if (empty) fs.rmdirSync(dirPath)
	return empty
}
