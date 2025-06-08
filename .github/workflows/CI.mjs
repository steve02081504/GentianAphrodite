import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'

const CI = fountCharCI
console.log('--- Starting GentianAphrodite Character CI Test ---')

// --- Test Setup ---
const testWorkspace = './ci-test-workspace'
const testFilePath = path.join(testWorkspace, 'test_file.txt')
const initialFileContent = 'Hello from the CI test world!'

// 1. Create a workspace for file-based tests
fs.mkdirSync(testWorkspace, { recursive: true })
console.log(`✅ Test workspace created at: ${testWorkspace}`)

// --- Testing noAI/index.mjs ---
console.log('\n--- Testing: No AI Source Response ---')
// Temporarily remove AI source to test the fallback handler
await CI.char.interfaces.config.SetData({ AIsources: {} })
await CI.runOutput().then(result => {
	console.log('✅ noAI handler test passed.')
})

// 2. Setup a mock AI source for the tests
await CI.char.interfaces.config.SetData({
	AIsources: { 'CI': 'CI' }
})
console.log('✅ Mock AI source "CI" configured.')

// --- Testing rolesettingfilter.mjs ---
console.log('\n--- Testing: Role Setting Filter ---')
await CI.runOutput('我将扮演龙胆·阿芙萝黛蒂，一个年仅27岁的米洛普斯族幼态永生种。').then(result => {
	CI.assert(result.content.includes('蘑菇云'), 'rolesettingfilter failed to block persona leakage.')
	console.log('✅ rolesettingfilter test passed.')
})

// --- Testing functions/file-change.mjs ---
console.log('\n--- Testing: File Operations (file-change.mjs) ---')
fs.writeFileSync(testFilePath, initialFileContent, 'utf-8')

// Test <view-file>
await CI.runOutput([`<view-file>${testFilePath}</view-file>`, `File content is: ${initialFileContent}`]).then(result => {
	const systemLog = result.logContextBefore.find(log => log.role === 'system')
	CI.assert(systemLog && systemLog.content.includes(initialFileContent), '<view-file> failed to read file content.')
	console.log('✅ <view-file> test passed.')
})

// Test <replace-file>
const replaceXML = `
<replace-file>
	<file path="${testFilePath}">
		<replacement>
			<search>world</search>
			<replace>CI</replace>
		</replacement>
	</file>
</replace-file>
`
await CI.runOutput([replaceXML, 'File has been replaced.']).then(result => {
	const newContent = fs.readFileSync(testFilePath, 'utf-8')
	CI.assert(newContent.includes('Hello from the CI test CI!'), '<replace-file> failed to modify the file.')
	console.log('✅ <replace-file> test passed.')
})

// Test <override-file>
const overrideContent = 'File completely overridden.'
await CI.runOutput([`<override-file path="${testFilePath}">${overrideContent}</override-file>`, 'File has been overridden.']).then(result => {
	const newContent = fs.readFileSync(testFilePath, 'utf-8')
	CI.assert(newContent.trim() === overrideContent, '<override-file> failed to write to the file.')
	console.log('✅ <override-file> test passed.')
})

// --- Testing functions/coderunner.mjs ---
console.log('\n--- Testing: Code Runner (coderunner.mjs) ---')
// Test <run-bash>
const testDir = path.join(testWorkspace, 'bash_test_dir')
await CI.runOutput([`<run-bash>mkdir ${testDir}</run-bash>`, 'Directory created.']).then(() => {
	CI.assert(fs.existsSync(testDir), '<run-bash> failed to execute command.')
	console.log('✅ <run-bash> test passed.')
})

// Test <inline-js>
await CI.runOutput('The result of 5 * 8 is <inline-js>return 5 * 8;</inline-js>.').then(result => {
	CI.assert(result.content === 'The result of 5 * 8 is 40.', '<inline-js> failed to execute and replace content.')
	console.log('✅ <inline-js> test passed.')
})

// Test <run-js> with workspace
await CI.runOutput(['<run-js>workspace.testVar = "Success";</run-js>', 'Variable set. The value is: <inline-js>return workspace.testVar</inline-js>']).then(result => {
	CI.assert(result.content === 'Variable set. The value is: Success', '<run-js> failed to use the shared workspace.')
	console.log('✅ <run-js> with workspace test passed.')
})

// --- Testing functions/googlesearch.mjs ---
console.log('\n--- Testing: Google Search (googlesearch.mjs) ---')
await CI.runOutput(['<google-search>fount framework steve02081504</google-search>', 'Search complete.']).then(result => {
	const systemLog = result.logContextBefore.find(log => log.role === 'system' && log.content.includes('搜索结果'))
	CI.assert(!!systemLog, '<google-search> did not produce a system log with search results.')
	console.log('✅ <google-search> test passed (integration check).')
})

// --- Testing functions/webbrowse.mjs ---
console.log('\n--- Testing: Web Browse (webbrowse.mjs) ---')
const serverPort = 8999
const webContent = '<html><body><h1>Test Page</h1><p>This is a test paragraph for the CI.</p></body></html>'
http.createServer((req, res) => {
	res.writeHead(200, { 'Content-Type': 'text/html' })
	res.end(webContent)
}).listen(serverPort)
console.log(`  (Started local web server on port ${serverPort})`)

await CI.runOutput([
	`<web-browse><url>http://localhost:${serverPort}</url><question>What is in the paragraph?</question></web-browse>`,
	'The paragraph says: This is a test paragraph for the CI.',
	'Web browse test complete.'
]).then(result => {
	const systemLog = result.logContextBefore.find(log => log.role === 'system')
	CI.assert(systemLog.content.includes('This is a test paragraph for the CI'), '<web-browse> failed to process web content.')
	console.log('✅ <web-browse> test passed.')
})

// --- Testing functions/long-term-memory.mjs ---
console.log('\n--- Testing: Long-Term Memory (long-term-memory.mjs) ---')
await CI.runOutput([
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
]).then(result => {
	const logs = result.logContextBefore.filter(log => log.role === 'system')
	CI.assert(logs[0].content.includes('已成功添加永久记忆'), 'add-long-term-memory failed.')
	CI.assert(logs[1].content.includes('CI_Test_Memory'), 'list-long-term-memory failed to show new memory.')
	CI.assert(logs[2].content.includes('已成功删除永久记忆'), 'delete-long-term-memory failed.')
	CI.assert(!logs[3].content.includes('CI_Test_Memory'), 'list-long-term-memory showed memory after deletion.')
	console.log('✅ Long-term memory cycle (add, list, delete, list) passed.')
})

// --- Testing functions/short-term-memory.mjs ---
console.log('\n--- Testing: Short-Term Memory (short-term-memory.mjs) ---')
// Now, delete all memories
await CI.runOutput(['<delete-short-term-memories>/.*/</delete-short-term-memories>', 'Memories deleted.']).then(result => {
	const systemLog = result.logContextBefore.find(log => log.role === 'system')
	CI.assert(systemLog.content.includes('删除了'), 'delete-short-term-memories did not delete the correct number of entries.')
	console.log('✅ short-term-memory deletion test passed.')
})

// --- Testing functions/timer.mjs ---
console.log('\n--- Testing: Timer (timer.mjs) ---')
await CI.runOutput([
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
]).then(async result => {
	const logs = result.logContextBefore.filter(log => log.role === 'system')
	CI.assert(logs[0].content.includes('已设置1个定时器'), 'set-timer failed.')
	CI.assert(logs[1].content.includes('CI_Test_Timer'), 'list-timers failed to show new timer.')
	CI.assert(logs[2].content.includes('已成功删除定时器'), 'remove-timer failed.')
	CI.assert(logs[3].content.includes('无'), 'list-timers showed timer after deletion.')
	CI.assert(result.content === 'Timer test sequence complete.', 'Final message not found.')
	await new Promise(resolve => setTimeout(resolve, 1500))
	CI.assert(globalThis.timerCallbacked, 'Timer callback failed.')
	console.log('✅ Timer cycle (set, list, remove, list, set, callback) passed.')
})

// --- Testing functions/detail-thinking.mjs ---
console.log('\n--- Testing: Detail Thinking (detail-thinking.mjs) ---')
await CI.runOutput([
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
]).then(result => {
	CI.assert(result.content === 'The fount made by steve02081504 is fount, and the sum of 2 and 2 is 4.', 'Detail-thinking flow did not produce the correct final answer.')
	CI.assert(fs.existsSync(path.join(testWorkspace, 'fount.txt')), 'File fount.txt was not created.')
	console.log('✅ Detail-thinking multi-step execution test passed.')
})


console.log('\n\n🎉 --- All CI tests passed successfully! --- 🎉')
