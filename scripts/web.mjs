import puppeteer from 'npm:puppeteer'
import TurndownService from 'npm:turndown'
import { where_command } from './exec.mjs'

/**
 * @param {string} name
 */
export async function NewBrowserGenerByName(name) {
	const path = await where_command(name)
	if (!path) return null
	return (configs) => puppeteer.launch({
		...configs,
		browser: name,
		executablePath: path
	})
}

/**
 * @param {import('npm:puppeteer').LaunchOptions} configs
 */
export async function NewBrowser(configs) {
	for (const name of ['firefox', 'chrome']) {
		const gener = await NewBrowserGenerByName(name)
		if (gener) return gener(configs)
	}
}

export async function MarkdownWebFetch(url) {
	const browser = await NewBrowser({
		headless: 'new'
	})
	const page = await browser.newPage()

	await page.goto(url, {
		waitUntil: 'networkidle2'
	})

	await page.evaluate(() => {
		document.querySelectorAll('script').forEach(el => el.remove())
		document.querySelectorAll('style').forEach(el => el.remove())
		document.querySelectorAll('link[rel="stylesheet"]').forEach(el => el.remove())
		document.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'))
		document.querySelectorAll('header').forEach(el => el.remove())
		document.querySelectorAll('footer').forEach(el => el.remove())
		document.querySelectorAll('noscript').forEach(el => el.remove())
		document.querySelectorAll('div[class*="highlight"]').forEach(el => {
			el.querySelectorAll('pre[class*="lineno"]').forEach(subEl => subEl.remove())
		})
		// 删除所有不可见元素
		document.querySelectorAll('[hidden]').forEach(el => el.remove())
		document.querySelectorAll('[aria-hidden="true"]').forEach(el => el.remove())
		document.querySelectorAll('*').forEach(el => {
			// deno-lint-ignore no-window
			const style = window.getComputedStyle(el)
			if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')
				el.remove()
		})

		document.querySelectorAll('div[class*="sidebar-container"]').forEach(el => el.remove())
		document.querySelectorAll('[id*="dismissable-notice"]').forEach(el => el.remove())
		document.querySelectorAll('[class*="navbar-mini"]').forEach(el => el.remove())
		document.querySelectorAll('[class*="navbar"]').forEach(el => el.remove())
	})
	if (url.includes('wikipedia.'))
		await page.evaluate(() => {
			document.querySelectorAll('[class*="vector-sticky-pinned-container"]').forEach(el => el.remove())
			document.querySelectorAll('[class*="vector-page-toolbar"]').forEach(el => el.remove())
			document.querySelectorAll('[class*="vector-body-before-content"]').forEach(el => el.remove())
			document.querySelectorAll('[class*="mw-editsection"]').forEach(el => el.remove())
			document.querySelectorAll('[class*="mw-jump-link"]').forEach(el => el.remove())
		})
	if (url.includes('moegirl.'))
		await page.evaluate(() => {
			// moegirl.org
			document.querySelectorAll('[id*="moe-article-header-container"]').forEach(el => el.remove())
			document.querySelectorAll('a[href*="&redlink=1"]').forEach(el => el.removeAttribute('href'))
			document.querySelectorAll('[class*="infobox-incompleted"]').forEach(el => el.remove())
			document.querySelectorAll('[id*="moe-mobile-toolbar"]').forEach(el => el.remove())
			document.querySelectorAll('[id*="moe-after-content"]').forEach(el => el.remove())
			document.querySelectorAll('[id*="moe-global-siderail"]').forEach(el => el.remove())
			document.querySelectorAll('[id*="moe-global-toolbar"]').forEach(el => el.remove())
			document.querySelectorAll('[id*="moe-open-in-app"]').forEach(el => el.remove())
			document.querySelectorAll('[id*="moe-page-tools-container"]').forEach(el => el.remove())
			document.querySelectorAll('[class*="n-notification-container"]').forEach(el => el.remove())
			document.querySelectorAll('[class*="n-message-container"]').forEach(el => el.remove())
			document.querySelectorAll('[id*="moe-a11y-navigations"]').forEach(el => el.remove())
			// moegirl.uk
			document.querySelectorAll('[id*="siteNotice"]').forEach(el => el.remove())
			document.querySelectorAll('[id*="siteSub"]').forEach(el => el.remove())
			document.querySelectorAll('[class*="mw-jump-link"]').forEach(el => el.remove())
			document.querySelectorAll('[id*="mw-navigation"]').forEach(el => el.remove())
		})
	if (url.includes('baike.baidu.com'))
		await page.evaluate(() => {
			document.querySelectorAll('[class*="index-module_pageHeader"]').forEach(el => el.remove())
			document.querySelectorAll('[class*="catalogWrapper"]').forEach(el => el.remove())
			document.querySelectorAll('[class*="sideContent"]').forEach(el => el.remove())
			document.querySelectorAll('[id*="J-related-search"]').forEach(el => el.remove())
			document.querySelectorAll('[class*="page-footer-content"]').forEach(el => el.remove())
			document.querySelectorAll('[class*="copyright"]').forEach(el => el.remove())
			document.querySelectorAll('[class*="ttsPlayerWrapper"]').forEach(el => el.remove())
			document.querySelectorAll('[class*="weChatLayer"]').forEach(el => el.remove())
			document.querySelectorAll('[class*="topToolsWrap"]').forEach(el => el.remove())
		})
	if (url.includes('learn.microsoft.com'))
		await page.evaluate(() => {
			document.querySelectorAll('[class*="popover-content"]').forEach(el => el.remove())
		})
	if (url.includes('stackoverflow.com'))
		await page.evaluate(() => {
			document.querySelectorAll('[id*="left-sidebar"]').forEach(el => el.remove())
			document.querySelectorAll('[id*="signup-modal-container"]').forEach(el => el.remove())
			document.querySelectorAll('[id*="homepage-wizard-container"]').forEach(el => el.remove())
			document.querySelectorAll('[id*="--stacks-s-tooltip"]').forEach(el => el.remove())
			document.querySelectorAll('[class*="js-post-menu"]').forEach(el => el.remove())
			document.querySelectorAll('[id*="post-form"]').forEach(el => el.remove())
		})

	const content = await page.content()
	await browser.close()

	const turndownService = new TurndownService({
		headingStyle: 'atx',
		codeBlockStyle: 'fenced'
	})

	const markdown = turndownService.turndown(content)
	return [...new Set([...markdown.split('\n')].filter(line => line.trim() !== ''))].join('\n')
}
