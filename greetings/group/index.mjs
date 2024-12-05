async function commonGreetings(args) {
	switch (args.locale) {
		default:
		case 'zh-CN':
			return (await import('./zh-CN.mjs')).commonGreetings(args)
		case 'en-US':
			return (await import('./en-US.mjs')).commonGreetings(args)
	}
}

export function groupGreetings(args) {
	return commonGreetings(args)
}
