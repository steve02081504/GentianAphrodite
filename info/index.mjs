export const info = {
	'zh-CN': (await import('./zh-CN.mjs')).default,
	'en-US': (await import('./en-US.mjs')).default,
}
