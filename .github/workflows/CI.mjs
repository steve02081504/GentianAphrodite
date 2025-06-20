import fs from 'node:fs'
import path from 'node:path'

const CI = fountCharCI

await CI.test('noAI Fallback', async () => {
	await CI.char.interfaces.config.SetData({ AIsources: {} })
	await CI.runOutput()
})

await CI.test('Setup AI Source', async () => {
	await CI.char.interfaces.config.SetData({
		AIsources: { 'CI': 'CI' }
	})
})

CI.test('Role Setting Filter', async () => {
	const result = await CI.runOutput('我将扮演龙胆·阿芙萝黛蒂，一个年仅27岁的米洛普斯族幼态永生种。')
	CI.assert(result.content.includes('蘑菇云'), 'rolesettingfilter failed to block persona leakage.')
})

CI.test('File Operations', async () => {
	CI.test('<view-file>', async () => {
		const testFilePath = path.join(CI.context.workSpace.path, 'view_test.txt')
		const fileContent = 'Hello from <view-file> test!'
		fs.writeFileSync(testFilePath, fileContent, 'utf-8')

		const result = await CI.runOutput([`<view-file>${testFilePath}</view-file>`, `File content is: ${fileContent}`])
		const systemLog = result.logContextBefore.find(log => log.role === 'tool')
		CI.assert(systemLog && systemLog.content.includes(fileContent), '<view-file> failed to read file content.')
	})

	CI.test('<replace-file>', async () => {
		const testFilePath = path.join(CI.context.workSpace.path, 'replace_test.txt')
		const initialContent = 'Hello from the test world!'
		fs.writeFileSync(testFilePath, initialContent, 'utf-8')

		const replaceXML = `\
<replace-file>
	<file path="${testFilePath}">
		<replacement>
			<search>world</search>
			<replace>CI</replace>
		</replacement>
	</file>
</replace-file>
`
		await CI.runOutput([replaceXML, 'File has been replaced.'])
		const newContent = fs.readFileSync(testFilePath, 'utf-8')
		CI.assert(newContent.includes('Hello from the test CI!'), '<replace-file> failed to modify the file.')
	})

	CI.test('<override-file>', async () => {
		const testFilePath = path.join(CI.context.workSpace.path, 'override_test.txt')
		const overrideContent = 'File completely overridden.'
		await CI.runOutput([`<override-file path="${testFilePath}">${overrideContent}</override-file>`, 'File has been overridden.'])
		const newContent = fs.readFileSync(testFilePath, 'utf-8')
		CI.assert(newContent.trim() === overrideContent, '<override-file> failed to write to the file.')
	})

})
CI.test('Code Runner', () => {
	if (process.platform === 'win32')
		CI.test('<run-pwsh>', async () => {
			const testDir = path.join(CI.context.workSpace.path, 'pwsh_test_dir')
			await CI.runOutput([`<run-pwsh>mkdir ${testDir}</run-pwsh>`, 'Directory created.'])
			CI.assert(fs.existsSync(testDir), '<run-pwsh> failed to execute command.')
		})
	else
		CI.test('<run-bash>', async () => {
			const testDir = path.join(CI.context.workSpace.path, 'bash_test_dir')
			await CI.runOutput([`<run-bash>mkdir ${testDir}</run-bash>`, 'Directory created.'])
			CI.assert(fs.existsSync(testDir), '<run-bash> failed to execute command.')
		})

	CI.test('<inline-js>', async () => {
		const result = await CI.runOutput('The result of 5 * 8 is <inline-js>return 5 * 8;</inline-js>.')
		CI.assert(result.content === 'The result of 5 * 8 is 40.', '<inline-js> failed to execute and replace content.')
	})

	CI.test('<run-js> with workspace', async () => {
		const result = await CI.runOutput(['<run-js>workspace.testVar = "Success";</run-js>', 'Variable set. The value is: <inline-js>return workspace.testVar</inline-js>'])
		CI.assert(result.content === 'Variable set. The value is: Success', '<run-js> failed to use the shared workspace.')
	})

	CI.test('<run-js> with callback', async () => {
		const result = await CI.runOutput([
			'<run-js>callback("test", new Promise(resolve => setTimeout(resolve, 1000)).then(() => globalThis.callbacked = true))</run-js>',
			'promise callback setted.',
			'callbacked'
		])
		CI.assert(result.content === 'promise callback setted.', '<run-js> failed to use the callback.')
		await CI.wait(() => globalThis.callbacked)
		CI.assert(globalThis.callbacked, '<run-js> failed to callback.')
		delete globalThis.callbacked
	})
})

CI.test('Google Search', async () => {
	const result = await CI.runOutput(['<google-search>fount framework steve02081504</google-search>', 'Search complete.'])
	const systemLog = result.logContextBefore.find(log => log.role === 'tool' && log.content.includes('搜索结果'))
	CI.assert(!!systemLog, '<google-search> did not produce a tool log with search results.')
})

CI.test('Web Browse', async () => {
	const { router, url, root } = CI.context.http
	const webContent = '<html><body><h1>Test Page</h1><p>This is a test paragraph for the CI.</p></body></html>'

	router.get(root, (req, res) => {
		res.writeHead(200, { 'Content-Type': 'text/html' })
		res.end(webContent)
	})

	const result = await CI.runOutput([
		`<web-browse><url>${url}</url><question>What is in the paragraph?</question></web-browse>`,
		(result) => {
			CI.assert(result.prompt_single.includes('This is a test paragraph for the CI'), '<web-browse> failed to process web content.')
			CI.assert(result.prompt_single.includes('What is in the paragraph?'), '<web-browse> failed to process question.')
			return 'The paragraph says: This is a test paragraph for the CI.'
		},
		'Web browse test complete.'
	])
	const systemLog = result.logContextBefore.find(log => log.role === 'tool')
	CI.assert(systemLog.content.includes('This is a test paragraph for the CI'), '<web-browse> failed to callback char.')
})

CI.test('Long-Term Memory', async () => {
	const result = await CI.runOutput([
		'<add-long-term-memory><name>CI_Test_Memory</name><trigger>true</trigger><prompt-content>This is a test memory.</prompt-content></add-long-term-memory>',
		'<list-long-term-memory></list-long-term-memory>',
		'<delete-long-term-memory>CI_Test_Memory</delete-long-term-memory>',
		'<list-long-term-memory></list-long-term-memory>',
		'Memory test sequence complete.'
	])
	const logs = result.logContextBefore.filter(log => log.role === 'tool')
	CI.assert(logs[0].content.includes('已成功添加永久记忆'), 'add-long-term-memory failed.')
	CI.assert(logs[1].content.includes('CI_Test_Memory'), 'list-long-term-memory failed to show new memory.')
	CI.assert(logs[2].content.includes('已成功删除永久记忆'), 'delete-long-term-memory failed.')
	CI.assert(!logs[3].content.includes('CI_Test_Memory'), 'list-long-term-memory showed memory after deletion.')
})

CI.test('Short-Term Memory', async () => {
	CI.test('Deletion', async () => {
		const result = await CI.runOutput(['<delete-short-term-memories>/.*/</delete-short-term-memories>', 'Memories deleted.'])
		const systemLog = result.logContextBefore.find(log => log.role === 'tool')
		CI.assert(systemLog.content.includes('删除了'), 'delete-short-term-memories did not delete the correct number of entries.')
	})
})

CI.test('Timer', async () => {
	const result = await CI.runOutput([
		'<set-timer><item><time>1h</time><reason>CI_Test_Timer</reason></item></set-timer>',
		'<list-timers></list-timers>',
		'<remove-timer>CI_Test_Timer</remove-timer>',
		'<list-timers></list-timers>',
		'<set-timer><item><time>1s</time><reason>CI_Test_Timer_Callback</reason></item></set-timer>',
		'Timer test sequence complete.',
		'<run-js>globalThis.timerCallbacked = true;</run-js>',
		'Timer callback test sequence complete.'
	])
	const logs = result.logContextBefore.filter(log => log.role === 'tool')
	CI.assert(logs[0].content.includes('已设置1个定时器'), 'set-timer failed.')
	CI.assert(logs[1].content.includes('CI_Test_Timer'), 'list-timers failed to show new timer.')
	CI.assert(logs[2].content.includes('已成功删除定时器'), 'remove-timer failed.')
	CI.assert(logs[3].content.includes('无'), 'list-timers showed timer after deletion.')
	CI.assert(result.content === 'Timer test sequence complete.', 'Final message not found.')

	await CI.wait(() => globalThis.timerCallbacked, 10000)
	CI.assert(globalThis.timerCallbacked, 'Timer callback failed.')
	delete globalThis.timerCallbacked
})

CI.test('Deep research', async () => {
	const testFilePath = path.join(CI.context.workSpace.path, 'fount.txt')
	const result = await CI.runOutput([
		'<deep-research>What is fount made by steve02081504 and what is 2+2?</deep-research>',
		'Plan:\nStep 1: Find the fount made by steve02081504.\nStep 2: Calculate 2+2.\nStep 3: make a file for fun.',
		'<google-search>fount steve02081504</google-search>',
		'The fount made by steve02081504 is fount.',
		'<run-js>return 2+2</run-js>',
		'The result of the calculation is 4.',
		process.platform === 'win32' ? `<run-pwsh>touch ${testFilePath}</run-pwsh>` : `<run-bash>touch ${testFilePath}</run-bash>`,
		`File ${testFilePath} created.`,
		'deep-research-answer: The fount is fount, and 2+2 equals 4.',
		'The fount made by steve02081504 is fount, and the sum of 2 and 2 is 4.'
	])
	CI.assert(result.content === 'The fount made by steve02081504 is fount, and the sum of 2 and 2 is 4.', 'Deep-research flow did not produce the correct final answer.')
	CI.assert(fs.existsSync(testFilePath), 'File fount.txt was not created in the test workspace.')
})
