async function commonGreetings(args) {
	switch (args.locale.split('-')[0]) {
		case 'zh':
			return (await import('./zh-CN.mjs')).commonGreetings(args)
		case 'en':
		default:
			return (await import('./en-US.mjs')).commonGreetings(args)
	}
}

export function groupGreetings(args) {
	return commonGreetings(args)
}
