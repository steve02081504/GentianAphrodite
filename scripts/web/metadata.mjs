import { getUrlFilename } from './url.mjs'

/**
 * 读取响应体，限制最大字节数。
 * @param {Response} response - Fetch 响应对象。
 * @param {number} limit - 最大字节数。
 * @returns {Promise<string>} - 读取到的文本内容。
 */
async function readResponseWithLimit(response, limit) {
	const reader = response.body.getReader()
	const chunks = []
	let totalLength = 0
	try {
		while (totalLength < limit) {
			const { done, value } = await reader.read()
			if (done) break
			chunks.push(value)
			totalLength += value.length
		}
		await reader.cancel()
	}
	finally {
		reader.releaseLock()
	}

	const combined = new Uint8Array(Math.min(totalLength, limit))
	let offset = 0
	for (const chunk of chunks) {
		const toCopy = Math.min(chunk.length, limit - offset)
		combined.set(chunk.slice(0, toCopy), offset)
		offset += toCopy
	}
	return new TextDecoder().decode(combined)
}

/**
 * 创建元数据对象：键值对记录，toString 时渲染为 Markdown 列表。
 * @param {Record<string, string>} record - 键值对。
 * @returns {Record<string, string> & { toString(): string }} - 带自定义 toString 的对象。
 */
function makeMetadataRecord(record) {
	return Object.assign(Object.create({
		/**
		 * 将元数据对象转换为 Markdown 列表。
		 * @returns {string} 元数据对象的 Markdown 列表。
		 */
		toString() {
			return Object.keys(this).map(k => `- ${k}: ${this[k]}`).join('\n')
		}
	}), record)
}

/**
 * 从 HTML 字符串解析元数据。
 * @param {string} html - HTML 内容。
 * @param {string} baseUrl - 用于解析相对 URL（如 favicon）的基准 URL。
 * @returns {Promise<Record<string, string>>} - 解析出的元数据键值对。
 */
async function parseMetadataFromHtml(html, baseUrl) {
	const { parse } = await import('npm:node-html-parser')
	const root = parse(html)
	/** @type {Record<string, string>} */
	const record = {}
	/**
	 * 添加元数据键值对。
	 * @param {string} key - 键。
	 * @param {string} value - 值。
	 */
	const add = (key, value) => {
		if (value && value.trim() && !(key in record)) record[key] = value.trim()
	}
	add('title', root.querySelector('title')?.text)
	add('description', root.querySelector('meta[name="description"]')?.getAttribute('content'))
	add('keywords', root.querySelector('meta[name="keywords"]')?.getAttribute('content'))
	add('author', root.querySelector('meta[name="author"]')?.getAttribute('content'))
	for (const el of root.querySelectorAll('meta[property^="og:"]')) {
		const property = el.getAttribute('property')
		const content = el.getAttribute('content')
		add(property, content)
	}
	for (const el of root.querySelectorAll('meta[name^="twitter:"]')) {
		const name = el.getAttribute('name')
		const content = el.getAttribute('content')
		add(name, content)
	}
	const favicon = root.querySelector('link[rel="icon"], link[rel="shortcut icon"]')?.getAttribute('href')
	if (favicon)
		try {
			add('favicon', new URL(favicon, baseUrl).href)
		}
		catch (e) {
			console.warn(`无法解析favicon的URL: ${favicon}`, e)
		}
	return record
}

/**
 * 获取给定 URL 的元数据。
 * 如果 URL 指向 HTML 页面，则提取标题、描述、图标和各种元标签。
 * 如果指向其他文件类型，则从响应头中提取文件名、类型和大小等信息。
 * @param {string} url - 要获取元数据的 URL。
 * @returns {Promise<Record<string, string>|null>} - 元数据键值对（toString 为 Markdown 列表），失败或无元数据时返回 null。
 */
export async function getUrlMetadata(url) {
	const controller = new AbortController()
	const timeoutId = setTimeout(() => controller.abort(), 5000) // 5秒超时
	/**
	 * 处理失败响应。
	 * @param {Response} response - 响应对象。
	 * @returns {Record<string, string> & { toString(): string }} - 包含状态码和状态文本的元数据对象。
	 */
	const handleFailedResponse = response => {
		const record = { status: String(response.status) }
		if (response.statusText) record.statusText = response.statusText
		return makeMetadataRecord(record)
	}
	let response = null
	let html = null
	try {
		// 步骤 1: 尝试使用 HEAD 请求获取头信息，以节省带宽
		response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal })

		// 步骤 2: 如果 HEAD 请求失败，尝试 GET 请求（最多 1MB）
		if (!response.ok) {
			response = await fetch(url, {
				method: 'GET',
				redirect: 'follow',
				signal: controller.signal,
				headers: { Range: 'bytes=0-1048575' }
			})
			try {
				if (!response.ok) return handleFailedResponse(response)

				if (response.headers.get('content-type')?.includes('text/html'))
					html = await readResponseWithLimit(response, 1024 * 1024)
			} finally {
				response.body.cancel().catch(() => { })
			}
		}

		const contentType = response.headers.get('content-type')
		/** @type {Record<string, string>} */
		let record = {}

		// 步骤 3: 判断内容类型，分支处理
		if (contentType?.includes('text/html')) {
			if (!html) {
				const getResponse = await fetch(url, { redirect: 'follow', signal: controller.signal })
				if (!getResponse.ok) return handleFailedResponse(getResponse)
				html = await getResponse.text()
			}
			record = await parseMetadataFromHtml(html, url)
		}
		else {
			const contentDisposition = response.headers.get('content-disposition')
			const contentLength = response.headers.get('content-length')
			const filename = getUrlFilename(url, contentDisposition)
			if (filename) record.filename = filename
			if (contentType) record.type = contentType.trim()
			if (contentLength) {
				const size = Number(contentLength)
				if (!Number.isNaN(size)) record.size = `${size} bytes`
			}
		}

		// 步骤 4: 统一返回结果
		if (!Object.keys(record).length) return null
		return makeMetadataRecord(record)
	}
	catch (e) {
		if (e.name === 'AbortError')
			console.warn(`Timeout getting metadata for ${url}`)
		else
			console.warn(`Failed to get metadata for ${url}:`, e)
		return null
	}
	finally {
		clearTimeout(timeoutId)
	}
}
