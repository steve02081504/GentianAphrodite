async function commonGreetings(args) {
	switch (args.locales[0].split('-')[0]) {
		case 'zh':
			return (await import('./zh-CN.mjs')).commonGreetings(args)
		case 'en':
		default:
			return (await import('./en-US.mjs')).commonGreetings(args)
	}
}

export function singalGreetings(args) {
	return commonGreetings(args)
}
