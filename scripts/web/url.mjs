import path from 'node:path'

/**
 * 从 URL 和 Content-Disposition 头中提取文件名。
 * @param {string} url - 文件的 URL。
 * @param {string} contentDisposition - Content-Disposition 头的内容。
 * @returns {string|null} - 提取的文件名，如果无法确定则返回 null。
 */
export function getUrlFilename(url, contentDisposition) {
	if (contentDisposition) {
		// 首先尝试 filename* (RFC 5987)，因为它支持字符集定义。
		// 示例: filename*=UTF-8''%e2%82%ac%20exchange%20rate.txt
		// 正则表达式捕获: 1=字符集 (可选), 2=编码后的文件名
		const filenameStarMatch = /filename\*=\s*(?:([^']*)'')?([^;]+?)/i.exec(contentDisposition)
		if (filenameStarMatch && filenameStarMatch[2])
			try {
				const filename = decodeURIComponent(filenameStarMatch[2])
				return path.basename(filename) // 清理以移除潜在的路径组件
			}
			catch (e) {
				console.warn(`从 Content-Disposition 解码 filename* 失败: '${filenameStarMatch[2]}'`, e)
				// 继续尝试 filename=
			}

		// 尝试 filename= (对于特殊字符不够健壮，但很常见)
		// 示例: filename="example.txt" 或 filename=example.txt
		// 正则表达式捕获: 1=带引号的文件名, 2=不带引号的文件名
		const filenameMatch = /filename=(?:"([^"]+)"|([^\s";]+))/i.exec(contentDisposition)
		if (filenameMatch) {
			const filename = filenameMatch[1] || filenameMatch[2]
			if (filename)
				return path.basename(filename) // 清理
		}
	}

	// 如果没有从 Content-Disposition 中获取到文件名，则回退到从 URL 路径中提取
	if (url)
		try {
			// 使用 URL 构造函数进行稳健的路径名解析和解码
			const parsedUrl = new URL(url)
			let { pathname } = parsedUrl // 例如 /path/to/file.txt 或 /path/to/dir/

			// 在处理前确保 pathname 不仅仅是 "/" 或空字符串
			if (pathname && pathname !== '/') {
				// 如果存在尾部斜杠，则移除 (除非是根目录本身，已在上面处理)
				if (pathname.endsWith('/') && pathname.length > 1)
					pathname = pathname.substring(0, pathname.length - 1)

				const lastSlashIndex = pathname.lastIndexOf('/')
				// 检查是否找到了 lastSlashIndex 并且其后有内容
				if (lastSlashIndex !== -1 && lastSlashIndex < pathname.length - 1)
					return path.basename(pathname.substring(lastSlashIndex + 1))
				// pathname 中没有斜杠，所以 pathname 本身就是文件名 (例如，从 "http://host/file.txt" 得到 "file.txt")
				else if (lastSlashIndex === -1 && pathname) return path.basename(pathname)
			}
		}
		catch (e) {
			console.warn(`使用 new URL() 解析 URL 出错: '${url}'`, e)
			// 对于 new URL() 可能无法处理的 URL (例如，格式错误) 的回退方案
			let pathPart = url
			// 移除查询字符串
			const queryIndex = pathPart.indexOf('?')
			if (queryIndex !== -1)
				pathPart = pathPart.substring(0, queryIndex)

			// 移除片段标识符
			const hashIndex = pathPart.indexOf('#')
			if (hashIndex !== -1)
				pathPart = pathPart.substring(0, hashIndex)

			const lastSlashIndex = pathPart.lastIndexOf('/')
			if (lastSlashIndex !== -1) {
				const filenameFromPath = pathPart.substring(lastSlashIndex + 1)
				if (filenameFromPath)
					try {
						// 解码 URI 组件，然后使用 path.basename 进行清理
						return path.basename(decodeURIComponent(filenameFromPath))
					}
					catch (decodeError) {
						// 如果解码失败，尝试返回原始段 (如果它很简单且不包含有问题字符)
						if (!/[\0-\x1f"%*:<>?\\|\x7f]/.test(filenameFromPath))
							return path.basename(filenameFromPath) // 即使未解码也进行清理
						console.warn(`从 URL 回退方案解码文件名失败: '${filenameFromPath}'`, decodeError)
					}
			}
		}

	return null // 无法确定文件名
}

/**
 * 在文本中查找所有 URL。
 * @param {string} text - 要在其中查找 URL 的文本。
 * @returns {string[]} - 找到的 URL 数组。
 */
export function findUrlsInText(text) {
	if (!text) return []
	const urlRegex = /https?:\/\/[^\s"'`]+/gi
	const urls = text.match(urlRegex)
	return urls ? [...new Set(urls)] : []
}
