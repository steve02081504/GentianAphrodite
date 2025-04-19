const MaxRetries = 3
export async function tryFewTimes(func, { times = MaxRetries, WhenFailsWaitFor = 2000 } = {}) {
	while (times--)
		try { return await func() }
		catch (error) {
			await new Promise(resolve => setTimeout(resolve, WhenFailsWaitFor))
			if (times === 0) throw error
		}
}
