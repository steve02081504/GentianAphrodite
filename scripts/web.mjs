import puppeteer from 'npm:puppeteer'
import TurndownService from 'npm:turndown'
import { where_command } from './exec.mjs' // 假设这是一个查找命令路径的辅助函数

const DEFAULT_NAVIGATION_TIMEOUT = 4.5 * 1000 // 设置一个默认导航超时时间 (毫秒)

/**
 * 根据浏览器地址创建一个 Puppeteer 启动器函数。
 * @param {string} path - 浏览器地址
 * @returns {Promise<Function>} - 返回一个接受配置并启动 Puppeteer 的函数，如果找不到浏览器则返回 null。
 */
export async function NewBrowserGenerByPath(path) {
	// 返回一个函数，该函数接收配置并启动 Puppeteer
	return (configs) => puppeteer.launch({
		...configs, // 合并传入的配置
		browser: path,
		product: path,
		executablePath: path,
	})
}

/**
 * 根据浏览器名称创建一个 Puppeteer 启动器函数。
 * @param {string} name - 浏览器名称 ('firefox', 'chrome', etc.)
 * @returns {Promise<Function|null>} - 返回一个接受配置并启动 Puppeteer 的函数，如果找不到浏览器则返回 null。
 */
export async function NewBrowserGenerByName(name) {
	const path = await where_command(name) // 查找浏览器的可执行文件路径
	if (!path) return null
	// 返回一个函数，该函数接收配置并启动 Puppeteer
	return NewBrowserGenerByPath(path)
}

/**
 * 尝试按顺序 ('firefox', 'chrome') 启动一个可用的浏览器。
 * @param {import('npm:puppeteer').LaunchOptions} configs - Puppeteer 的启动配置。
 * @returns {Promise<import('npm:puppeteer').Browser>} - 返回一个 Puppeteer 浏览器实例。
 * @throws {Error} - 如果没有找到或无法启动任何支持的浏览器。
 */
export async function NewBrowser(configs) {
	const browserPriority = ['firefox', 'chrome']
	for (const name of browserPriority) {
		const generator = await NewBrowserGenerByName(name) // 获取对应浏览器的启动器
		if (generator) try {
			const browser = await generator(configs) // 尝试使用启动器启动浏览器
			console.info(`Successfully launched browser: ${name}`)
			return browser // 成功则返回浏览器实例
		}
		catch (error) {
			console.warn(`Failed to launch ${name}: ${error.stack}. Trying next browser.`)
		}
	}
	try {
		const edgePath = await where_command('msedge') || (await import('npm:edge-paths')).getEdgePath()
		const generator = await NewBrowserGenerByPath(edgePath)
		if (generator) {
			const browser = await generator(configs)
			console.info('Successfully launched browser: Edge')
			return browser
		}
	} catch (error) {
		console.warn(`Failed to launch Edge: ${error.stack}.`)
	}

	throw new Error('Failed to launch any supported browser (Firefox or Chrome or Edge).')
}

/**
 * 从给定的 URL 获取网页内容，清理 HTML，并将其转换为 Markdown 格式。
 * @param {string} url - 要抓取的网页 URL。
 * @returns {Promise<string>} - 返回清理和转换后的 Markdown 文本。
 * @throws {Error} - 如果在过程中发生严重错误（如浏览器启动失败、导航失败等）。
 */
export async function MarkdownWebFetch(url) {
	let browser = null // 初始化 browser 变量
	console.info(`Starting Markdown fetch process for URL: ${url}`)

	try {
		// 启动浏览器，使用 'new' 无头模式
		browser = await NewBrowser({
			headless: 'new',
		})

		const page = await browser.newPage()

		// 设置默认导航超时
		page.setDefaultNavigationTimeout(DEFAULT_NAVIGATION_TIMEOUT)

		console.info(`Navigating to URL: ${url}`)
		// 导航到目标 URL，等待网络基本空闲（最多2个活动连接）
		await page.goto(url, {
			waitUntil: 'networkidle2',
		})
		console.info(`Navigation successful for URL: ${url}`)

		console.info('Starting DOM cleanup.')
		try {
			// 在页面上下文中执行 JavaScript 以清理 DOM
			await page.evaluate(() => {
				// 通用清理：移除脚本、样式、链接样式表、内联样式、页眉、页脚、noscript 标签
				document.querySelectorAll('script, style, link[rel="stylesheet"], header, footer, noscript').forEach(el => el.remove())
				document.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'))

				// 清理特定代码高亮库产生的行号
				document.querySelectorAll('div[class*="highlight"] pre[class*="lineno"]').forEach(el => el.remove())

				// 移除明确隐藏或ARIA隐藏的元素
				document.querySelectorAll('[hidden], [aria-hidden="true"]').forEach(el => el.remove())

				// 移除计算样式为不可见的元素（注意：这可能比较耗时）
				document.querySelectorAll('*').forEach(el => {
					if (!el.isConnected) return // 避免处理已移除的元素
					try {
						// deno-lint-ignore no-window
						const style = window.getComputedStyle(el)
						if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
							el.remove()
					} catch (e) {
						// 忽略获取样式的错误 (例如，对于某些特殊元素)
					}
				})

				// 移除常见的侧边栏、通知、导航栏等容器
				document.querySelectorAll(
					'div[class*="sidebar-container"], [id*="dismissable-notice"], [class*="navbar-mini"], [class*="navbar"]'
				).forEach(el => el.remove())
			})

			// --- 特定网站清理逻辑 ---
			const cleanupConfig = [
				{
					pattern: 'wikipedia.', selectors: [
						'[class*="vector-sticky-pinned-container"]', '[class*="vector-page-toolbar"]',
						'[class*="vector-body-before-content"]', '[class*="mw-editsection"]', '[class*="mw-jump-link"]'
					]
				},
				{
					pattern: 'moegirl.', selectors: [
						// moegirl.org
						'[id*="moe-article-header-container"]', '[class*="infobox-incompleted"]', '[id*="moe-mobile-toolbar"]',
						'[id*="moe-after-content"]', '[id*="moe-global-siderail"]', '[id*="moe-global-toolbar"]',
						'[id*="moe-open-in-app"]', '[id*="moe-page-tools-container"]', '[class*="n-notification-container"]',
						'[class*="n-message-container"]', '[id*="moe-a11y-navigations"]',
						// moegirl.uk & others
						'[id*="siteNotice"]', '[id*="siteSub"]', '[class*="mw-jump-link"]', '[id*="mw-navigation"]'
					], actions: () => { // 特定操作：移除红链的 href
						document.querySelectorAll('a[href*="&redlink=1"]').forEach(el => el.removeAttribute('href'))
					}
				},
				{
					pattern: 'baike.baidu.com', selectors: [
						'[class*="index-module_pageHeader"]', '[class*="catalogWrapper"]', '[class*="sideContent"]',
						'[id*="J-related-search"]', '[class*="page-footer-content"]', '[class*="copyright"]',
						'[class*="ttsPlayerWrapper"]', '[class*="weChatLayer"]', '[class*="topToolsWrap"]'
					]
				},
				{ pattern: 'learn.microsoft.com', selectors: ['[class*="popover-content"]'] },
				{
					pattern: 'stackoverflow.com', selectors: [
						'[id*="left-sidebar"]', '[id*="signup-modal-container"]', '[id*="homepage-wizard-container"]',
						'[id*="--stacks-s-tooltip"]', '[class*="js-post-menu"]', '[id*="post-form"]'
					]
				}
			]

			for (const config of cleanupConfig)
				if (url.includes(config.pattern)) {
					await page.evaluate((selectors, runActions) => {
						selectors.forEach(selector => {
							document.querySelectorAll(selector).forEach(el => el.remove())
						})
						if (runActions)
							runActions() // 执行特定操作，如果定义了的话

					}, config.selectors, config.actions) // 传递选择器和操作函数
					break // 假设一个 URL 只匹配一个模式
				}

			console.info('DOM cleanup finished.')

		}
		catch (error) {
			console.error(`Error during DOM cleanup execution (page.evaluate): ${error}`)
		}

		console.info('Fetching cleaned HTML content.')
		const content = await page.content() // 获取清理后的 HTML 内容
		console.info('HTML content fetched.')

		console.info('Initializing Turndown service for HTML to Markdown conversion.')
		// 初始化 Turndown 服务，用于将 HTML 转换为 Markdown
		const turndownService = new TurndownService({
			headingStyle: 'atx', // 使用 '#' 样式的标题
			codeBlockStyle: 'fenced', // 使用围栏代码块 (```)
		})

		console.info('Converting HTML to Markdown.')
		const markdown = turndownService.turndown(content) // 执行转换
		console.info('Markdown conversion finished.')

		// 后处理 Markdown：分割成行，过滤掉只包含空白字符的行，然后重新组合
		console.info('Post-processing Markdown.')
		const cleanedMarkdown = markdown.split('\n')
			.filter(line => line.trim() !== '') // 过滤掉空行或只含空白的行
			.filter((line, index, self) => self.indexOf(line) === index) // 去重所有重复行
			.join('\n') // 用换行符重新连接各行

		console.info('Markdown processing complete.')
		return cleanedMarkdown // 返回最终的 Markdown 字符串
	}
	catch (error) {
		// 捕获在整个过程中发生的任何未处理错误
		console.error(`An error occurred during the MarkdownWebFetch process: ${error}`)
		throw error // 将错误向上层抛出
	}
	finally {
		// 无论成功还是失败，都确保关闭浏览器
		if (browser) {
			console.info('Closing the browser.')
			await browser.close()
			console.info('Browser closed.')
		}
		else
			console.info('No browser instance to close.')
	}
}
