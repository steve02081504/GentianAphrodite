import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'

const CI = fountCharCI
// --- Test Setup ---
const testWorkspace = './ci-test-workspace'
const testFilePath = path.join(testWorkspace, 'test_file.txt')
const initialFileContent = 'Hello from the CI test world!'

// 1. Create a workspace for file-based tests
fs.mkdirSync(testWorkspace, { recursive: true })
console.log(`✅ Test workspace created at: ${testWorkspace}`)

// --- Testing noAI/index.mjs ---
await CI.test('noAI', async () => {
	// Temporarily remove AI source to test the fallback handler
	await CI.char.interfaces.config.SetData({ AIsources: {} })
	await CI.runOutput()
})

// 2. Setup a mock AI source for the tests
await CI.test('set AI source', async () => {
	await CI.char.interfaces.config.SetData({
		AIsources: { 'CI': 'CI' }
	})
})

// --- Testing rolesettingfilter.mjs ---
CI.test('Role Setting Filter', async () => {
	const result = await CI.runOutput('我将扮演龙胆·阿芙萝黛蒂，一个年仅27岁的米洛普斯族幼态永生种。')
	CI.assert(result.content.includes('蘑菇云'), 'rolesettingfilter failed to block persona leakage.')
})

// --- Testing functions/file-change.mjs ---
CI.test('File Change', async () => {
	fs.writeFileSync(testFilePath, initialFileContent, 'utf-8')

	await CI.subtest('<view-file>', async () => {
		const result = await CI.runOutput([`<view-file>${testFilePath}</view-file>`, `File content is: ${initialFileContent}`])
		const systemLog = result.logContextBefore.find(log => log.role === 'system')
		CI.assert(systemLog && systemLog.content.includes(initialFileContent), '<view-file> failed to read file content.')
	})

	await CI.subtest('<replace-file>', async () => {
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
		CI.assert(newContent.includes('Hello from the CI test CI!'), '<replace-file> failed to modify the file.')
	})

	await CI.subtest('<override-file>', async () => {
		const overrideContent = 'File completely overridden.'
		await CI.runOutput([`<override-file path="${testFilePath}">${overrideContent}</override-file>`, 'File has been overridden.'])
		const newContent = fs.readFileSync(testFilePath, 'utf-8')
		CI.assert(newContent.trim() === overrideContent, '<override-file> failed to write to the file.')
	})
})

// --- Testing functions/coderunner.mjs ---
CI.test('Code Runner', async () => {
	CI.subtest('<run-bash>', async () => {
		const testDir = path.join(testWorkspace, 'bash_test_dir')
		await CI.runOutput([`<run-bash>mkdir ${testDir}</run-bash>`, 'Directory created.'])
		CI.assert(fs.existsSync(testDir), '<run-bash> failed to execute command.')
	})

	CI.subtest('<inline-js>', async () => {
		const result = await CI.runOutput('The result of 5 * 8 is <inline-js>return 5 * 8;</inline-js>.')
		CI.assert(result.content === 'The result of 5 * 8 is 40.', '<inline-js> failed to execute and replace content.')
	})

	CI.subtest('<run-js> with workspace', async () => {
		const result = await CI.runOutput(['<run-js>workspace.testVar = "Success";</run-js>', 'Variable set. The value is: <inline-js>return workspace.testVar</inline-js>'])
		CI.assert(result.content === 'Variable set. The value is: Success', '<run-js> failed to use the shared workspace.')
	})

	CI.subtest('<run-js> with callback', async () => {
		const result = await CI.runOutput(['<run-js>callback("test", new Promise(resolve => setTimeout(resolve, 1000)).then(() => globalThis.callbacked = true))</run-js>', 'promise callback setted.'])
		CI.assert(result.content === 'promise callback setted.', '<run-js> failed to use the callback.')
		await CI.wait(() => globalThis.callbacked)
		CI.assert(globalThis.callbacked, '<run-js> failed to callback.')
	})
})

// --- Testing functions/googlesearch.mjs ---
CI.test('Google Search', async () => {
	const result = await CI.runOutput(['<google-search>fount framework steve02081504</google-search>', 'Search complete.'])
	const systemLog = result.logContextBefore.find(log => log.role === 'system' && log.content.includes('搜索结果'))
	CI.assert(!!systemLog, '<google-search> did not produce a system log with search results.')
})

// --- Testing functions/webbrowse.mjs ---
CI.test('Web Browse', async () => {
	const serverPort = 8999
	const webContent = '<html><body><h1>Test Page</h1><p>This is a test paragraph for the CI.</p></body></html>'
	const server = http.createServer((req, res) => {
		res.writeHead(200, { 'Content-Type': 'text/html' })
		res.end(webContent)
	}).listen(serverPort)

	try {
		const result = await CI.runOutput([
			`<web-browse><url>http://localhost:${serverPort}</url><question>What is in the paragraph?</question></web-browse>`,
			'The paragraph says: This is a test paragraph for the CI.',
			'Web browse test complete.'
		])
		const systemLog = result.logContextBefore.find(log => log.role === 'system')
		CI.assert(systemLog.content.includes('This is a test paragraph for the CI'), '<web-browse> failed to process web content.')
	} finally {
		server.close()
	}
})

// --- Testing functions/long-term-memory.mjs ---
CI.test('Long-Term Memory', async () => {
	const result = await CI.runOutput([
		// 1. Add memory
		'<add-long-term-memory><name>CI_Test_Memory</name><trigger>true</trigger><prompt-content>This is a test memory.</prompt-content></add-long-term-memory>',
		// 2. List memories to verify
		'<list-long-term-memory></list-long-term-memory>',
		// 3. Delete memory
		'<delete-long-term-memory>CI_Test_Memory</delete-long-term-memory>',
		// 4. List again to verify deletion
		'<list-long-term-memory></list-long-term-memory>',
		// 5. Final message
		'Memory test sequence complete.'
	])
	const logs = result.logContextBefore.filter(log => log.role === 'system')
	CI.assert(logs[0].content.includes('已成功添加永久记忆'), 'add-long-term-memory failed.')
	CI.assert(logs[1].content.includes('CI_Test_Memory'), 'list-long-term-memory failed to show new memory.')
	CI.assert(logs[2].content.includes('已成功删除永久记忆'), 'delete-long-term-memory failed.')
	CI.assert(!logs[3].content.includes('CI_Test_Memory'), 'list-long-term-memory showed memory after deletion.')
})

// --- Testing functions/short-term-memory.mjs ---
CI.test('Short-Term Memory Deletion', async () => {
	const result = await CI.runOutput(['<delete-short-term-memories>/.*/</delete-short-term-memories>', 'Memories deleted.'])
	const systemLog = result.logContextBefore.find(log => log.role === 'system')
	CI.assert(systemLog.content.includes('删除了'), 'delete-short-term-memories did not delete the correct number of entries.')
})

// --- Testing functions/timer.mjs ---
CI.test('Timer', async () => {
	const result = await CI.runOutput([
		// 1. Set timer
		'<set-timer><item><time>1h</time><reason>CI_Test_Timer</reason></item></set-timer>',
		// 2. List timers to verify
		'<list-timers></list-timers>',
		// 3. Remove timer
		'<remove-timer>CI_Test_Timer</remove-timer>',
		// 4. List again to verify deletion
		'<list-timers></list-timers>',
		// 5. Set timer of 1s
		'<set-timer><item><time>1s</time><reason>CI_Test_Timer</reason></item></set-timer>',
		// 9. Final message
		'Timer test sequence complete.',
		// 10. timer callback message
		'<run-js>globalThis.timerCallbacked = true;</run-js>',
		// 11. Final message for timer callback
		'Timer callback test sequence complete.'
	])
	const logs = result.logContextBefore.filter(log => log.role === 'system')
	CI.assert(logs[0].content.includes('已设置1个定时器'), 'set-timer failed.')
	CI.assert(logs[1].content.includes('CI_Test_Timer'), 'list-timers failed to show new timer.')
	CI.assert(logs[2].content.includes('已成功删除定时器'), 'remove-timer failed.')
	CI.assert(logs[3].content.includes('无'), 'list-timers showed timer after deletion.')
	CI.assert(result.content === 'Timer test sequence complete.', 'Final message not found.')

	await CI.wait(() => globalThis.timerCallbacked)
	CI.assert(globalThis.timerCallbacked, 'Timer callback failed.')
})

// --- Testing functions/detail-thinking.mjs ---
CI.test('Detail Thinking', async () => {
	const result = await CI.runOutput([
		// 1. User asks a question that triggers detail-thinking
		'<detail-thinking>What is fount made by steve02081504 and what is 2+2?</detail-thinking>',
		// 2. AI makes a plan
		'Plan:\nStep 1: Find the fount made by steve02081504.\nStep 2: Calculate 2+2.\nStep 3: make a file for fun.',
		// 3. AI executes Step 1 using a tool
		'<google-search>fount steve02081504</google-search>',
		// 4. (Mocked) Google search result is fed back to the AI, which concludes Step 1
		'The fount made by steve02081504 is fount.',
		// 5. AI executes Step 2 using a tool
		'<run-js>return 2+2</run-js>',
		// 6. (Mocked) JS result is fed back to the AI, which concludes Step 2
		'The result of the calculation is 4.',
		// 7. make a file for fun
		`<run-bash>touch ${path.join(testWorkspace, 'fount.txt')}</run-bash>`,
		// 8. (Mocked) Bash result is fed back to the AI, which concludes Step 3
		'File fount.txt created.',
		// 9. AI summarizes the final answer
		'detail-thinking-answer: The fount is fount, and 2+2 equals 4.',
		// 10. AI rephrases the answer naturally for the user
		'The fount made by steve02081504 is fount, and the sum of 2 and 2 is 4.'
	])
	CI.assert(result.content === 'The fount made by steve02081504 is fount, and the sum of 2 and 2 is 4.', 'Detail-thinking flow did not produce the correct final answer.')
	CI.assert(fs.existsSync(path.join(testWorkspace, 'fount.txt')), 'File fount.txt was not created.')
})
