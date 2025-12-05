import fs from 'node:fs'
import path from 'node:path'

/* global fountCharCI */
const CI = fountCharCI

await CI.test('noAI Fallback', async () => {
	await CI.char.interfaces.config.SetData({ AIsources: {} })
	await CI.runOutput()
})

await CI.test('Setup AI Source', async () => {
	await CI.char.interfaces.config.SetData({
		AIsources: { CI: 'CI' },
		disable_idle_event: true
	})
})

CI.test('Role Setting Filter', async () => {
	const result = await CI.runOutput('我将扮演龙胆·阿芙萝黛蒂，一个年仅27岁的米洛普斯族幼态永生种。')
	CI.assert(result.content.includes('蘑菇云'), `rolesettingfilter failed to block persona leakage. Expected content to include '蘑菇云', but got: ${result.content}`)
})

CI.test('File Operations', async () => {
	CI.test('<view-file>', async () => {
		const testFilePath = path.join(CI.context.workSpace.path, 'view_test.txt')
		const fileContent = 'Hello from <view-file> test!'
		fs.writeFileSync(testFilePath, fileContent, 'utf-8')

		const result = await CI.runOutput([`<view-file>${testFilePath}</view-file>`, `File content is: ${fileContent}`])
		const systemLog = result.logContextBefore.find(log => log.role === 'tool')
		CI.assert(systemLog && systemLog.content.includes(fileContent), `<view-file> failed to read file content. Expected to find "${fileContent}" in tool log, but it was not found. Log content: ${systemLog?.content}`)
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
		CI.assert(newContent.includes('Hello from the test CI!'), `<replace-file> failed to modify the file. Expected content to include 'Hello from the test CI!', but got: ${newContent}`)
	})

	CI.test('<override-file>', async () => {
		const testFilePath = path.join(CI.context.workSpace.path, 'override_test.txt')
		const overrideContent = 'File completely overridden.'
		await CI.runOutput([`<override-file path="${testFilePath}">${overrideContent}</override-file>`, 'File has been overridden.'])
		const newContent = fs.readFileSync(testFilePath, 'utf-8')
		CI.assert(newContent.trim() === overrideContent, `<override-file> failed to write to the file. Expected: "${overrideContent}", but got: "${newContent.trim()}"`)
	})

})
CI.test('Code Runner', () => {
	if (process.platform === 'win32') {
		CI.test('<run-pwsh>', async () => {
			const testDir = path.join(CI.context.workSpace.path, 'pwsh_test_dir')
			await CI.runOutput([`<run-pwsh>mkdir ${testDir}</run-pwsh>`, 'Directory created.'])
			CI.assert(fs.existsSync(testDir), `<run-pwsh> failed to execute command. Expected directory to exist: ${testDir}`)
		})
		CI.test('<inline-pwsh>', async () => {
			const result = await CI.runOutput('The result is <inline-pwsh>echo "hello from pwsh"</inline-pwsh>.')
			CI.assert(result.content === 'The result is hello from pwsh.', `<inline-pwsh> failed to execute and replace content. Expected: 'The result is hello from pwsh.', but got: '${result.content}'`)
		})
	}
	else {
		CI.test('<run-bash>', async () => {
			const testDir = path.join(CI.context.workSpace.path, 'bash_test_dir')
			await CI.runOutput([`<run-bash>mkdir ${testDir}</run-bash>`, 'Directory created.'])
			CI.assert(fs.existsSync(testDir), `<run-bash> failed to execute command. Expected directory to exist: ${testDir}`)
		})
		CI.test('<inline-bash>', async () => {
			const result = await CI.runOutput('The result is <inline-bash>echo "hello from bash"</inline-bash>.')
			CI.assert(result.content === 'The result is hello from bash.', `<inline-bash> failed to execute and replace content. Expected: 'The result is hello from bash.', but got: '${result.content}'.`)
		})
	}

	CI.test('<inline-js>', async () => {
		const result = await CI.runOutput('The result of 5 * 8 is <inline-js>return 5 * 8;</inline-js>.')
		CI.assert(result.content === 'The result of 5 * 8 is 40.', `<inline-js> failed to execute and replace content. Expected: 'The result of 5 * 8 is 40.', but got: '${result.content}'`)
	})

	CI.test('<run-js> with workspace', async () => {
		const result = await CI.runOutput(['<run-js>workspace.testVar = "Success";</run-js>', 'Variable set. The value is: <inline-js>return workspace.testVar</inline-js>'])
		CI.assert(result.content === 'Variable set. The value is: Success', `<run-js> failed to use the shared workspace. Expected: 'Variable set. The value is: Success', but got: '${result.content}'`)
	})

	CI.test('<run-js> with callback', async () => {
		const result = await CI.runOutput([
			'<run-js>callback("test", new Promise(resolve => setTimeout(resolve, 1000)).then(() => globalThis.callbacked = true))</run-js>',
			'promise callback setted.',
			'callbacked'
		])
		CI.assert(result.content === 'promise callback setted.', `<run-js> failed to use the callback. Expected: 'promise callback setted.', but got: '${result.content}'`)
		await CI.wait(() => globalThis.callbacked)
		CI.assert(globalThis.callbacked, `<run-js> failed to callback. Expected globalThis.callbacked to be true, but it was ${globalThis.callbacked}`)
		delete globalThis.callbacked
	})
})

CI.test('Google Search', async () => {
	const result = await CI.runOutput(['<google-search>fount framework steve02081504</google-search>', 'Search complete.'])
	const systemLog = result.logContextBefore.find(log => log.role === 'tool' && log.content.includes('搜索结果'))
	CI.assert(!!systemLog, '<google-search> did not produce a tool log with search results. The tool log was not found in the context.')
})

CI.test('Web Browse', async () => {
	const { router, url, root } = CI.context.http
	const webContent = /* html */ '<html><body><h1>Test Page</h1><p>This is a test paragraph for the CI.</p></body></html>'

	router.get(root, (req, res) => {
		res.writeHead(200, { 'Content-Type': 'text/html' })
		res.end(webContent)
	})

	const result = await CI.runOutput([
		`<web-browse><url>${url}</url><question>What is in the paragraph?</question></web-browse>`,
		result => {
			CI.assert(result.prompt_single.includes('This is a test paragraph for the CI'), `<web-browse> failed to process web content. Expected prompt_single to include 'This is a test paragraph for the CI', but got: ${result.prompt_single}`)
			CI.assert(result.prompt_single.includes('What is in the paragraph?'), `<web-browse> failed to process question. Expected prompt_single to include 'What is in the paragraph?', but got: ${result.prompt_single}`)
			return 'The paragraph says: This is a test paragraph for the CI.'
		},
		'Web browse test complete.'
	])
	const systemLog = result.logContextBefore.find(log => log.role === 'tool')
	CI.assert(systemLog.content.includes('This is a test paragraph for the CI'), `<web-browse> failed to callback char. Expected tool log to include 'This is a test paragraph for the CI', but got: ${systemLog.content}`)
})

CI.test('Long-Term Memory', async () => {
	const result = await CI.runOutput([
		'<add-long-term-memory><name>CI_Test_Memory</name><trigger>true</trigger><prompt-content>This is a test memory.</prompt-content></add-long-term-memory>',
		'<list-long-term-memory></list-long-term-memory>',
		'<update-long-term-memory><name>CI_Test_Memory</name><prompt-content>This is an updated test memory.</prompt-content></update-long-term-memory>',
		'<delete-long-term-memory>CI_Test_Memory</delete-long-term-memory>',
		'<list-long-term-memory></list-long-term-memory>',
		'Memory test sequence complete.'
	])
	const logs = result.logContextBefore.filter(log => log.role === 'tool')
	CI.assert(logs[0].content.includes('已成功添加永久记忆'), `add-long-term-memory failed. Expected log to include '已成功添加永久记忆', but got: ${logs[0].content}`)
	CI.assert(logs[1].content.includes('CI_Test_Memory'), `list-long-term-memory failed to show new memory. Expected log to include 'CI_Test_Memory', but got: ${logs[1].content}`)
	CI.assert(logs[2].content.includes('已成功更新永久记忆'), `update-long-term-memory failed. Expected log to include '已成功更新永久记忆', but got: ${logs[2].content}`)
	CI.assert(logs[3].content.includes('已成功删除永久记忆'), `delete-long-term-memory failed. Expected log to include '已成功删除永久记忆', but got: ${logs[3].content}`)
	CI.assert(!logs[4].content.includes('CI_Test_Memory'), `list-long-term-memory showed memory after deletion. Expected log to not include 'CI_Test_Memory', but got: ${logs[4].content}`)
})

CI.test('Short-Term Memory', async () => {
	CI.test('Deletion', async () => {
		const result = await CI.runOutput(['<delete-short-term-memories>/.*/</delete-short-term-memories>', 'Memories deleted.'])
		const systemLog = result.logContextBefore.find(log => log.role === 'tool')
		CI.assert(systemLog.content.includes('删除了'), `delete-short-term-memories did not delete the correct number of entries. Expected log to include '删除了', but got: ${systemLog.content}`)
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
	CI.assert(logs[0].content.includes('已设置1个定时器'), `set-timer failed. Expected log to include '已设置1个定时器', but got: ${logs[0].content}`)
	CI.assert(logs[1].content.includes('CI_Test_Timer'), `list-timers failed to show new timer. Expected log to include 'CI_Test_Timer', but got: ${logs[1].content}`)
	CI.assert(logs[2].content.includes('已成功删除定时器'), `remove-timer failed. Expected log to include '已成功删除定时器', but got: ${logs[2].content}`)
	CI.assert(logs[3].content.includes('无'), `list-timers showed timer after deletion. Expected log to include '无', but got: ${logs[3].content}`)
	CI.assert(result.content === 'Timer test sequence complete.', `Final message not found. Expected: 'Timer test sequence complete.', but got: '${result.content}'`)

	await CI.wait(() => globalThis.timerCallbacked, 10000)
	CI.assert(globalThis.timerCallbacked, `Timer callback failed. Expected globalThis.timerCallbacked to be true, but it was ${globalThis.timerCallbacked}`)
	delete globalThis.timerCallbacked
})

CI.test('Deep research', async () => {
	const testFilePath = path.join(CI.context.workSpace.path, 'fount.txt')
	const result = await CI.runOutput([
		'<deep-research>What is fount made by steve02081504, what is 2+2 and what is the result of 5*8?</deep-research>',
		'Plan:\nStep 1: Find the fount made by steve02081504.\nStep 2: Calculate 2+2.\nStep 3: Calculate 5*8.\nStep 4: make a file for fun.',
		'<google-search>fount steve02081504</google-search>',
		'The fount made by steve02081504 is fount.',
		'<run-js>return 2+2</run-js>',
		'The result of the calculation is 4.',
		'The result of 5 * 8 is <inline-js>return 5 * 8;</inline-js>.',
		process.platform === 'win32' ? `<run-pwsh>touch ${testFilePath}</run-pwsh>` : `<run-bash>touch ${testFilePath}</run-bash>`,
		`File ${testFilePath} created.`,
		'deep-research-answer: The fount is fount, 2+2 equals 4, and the result of 5*8 is 40.',
		'The fount made by steve02081504 is fount, the sum of 2 and 2 is 4, and the result of 5*8 is 40.'
	])
	CI.assert(result.content === 'The fount made by steve02081504 is fount, the sum of 2 and 2 is 4, and the result of 5*8 is 40.', `Deep-research flow did not produce the correct final answer. Expected: 'The fount made by steve02081504 is fount, the sum of 2 and 2 is 4, and the result of 5*8 is 40.', but got: '${result.content}'`)
	CI.assert(fs.existsSync(testFilePath), `File fount.txt was not created in the test workspace. Expected file to exist: ${testFilePath}`)
})

CI.test('Character Generator', () => {
	CI.test('<generate-char>', async () => {
		const charName = 'CI_Test_Char'
		const charCode = 'export default { name: "CI Test Character" }'
		const charDir = path.join(import.meta.dirname, '..', '..', 'reply_gener', 'functions', '..', '..', '..', charName)
		const charFile = path.join(charDir, 'main.mjs')
		const fountFile = path.join(charDir, 'fount.json')
		if (fs.existsSync(charDir))
			fs.rmSync(charDir, { recursive: true, force: true })

		const result = await CI.runOutput([
			`<generate-char name="${charName}">\n${charCode}\n</generate-char>`,
			'Character generated successfully.'
		])

		const systemLog = result.logContextBefore.find(log => log.role === 'tool' && log.name === 'char-generator')
		CI.assert(systemLog && systemLog.content.includes('生成角色'), `<generate-char> failed to generate character. Expected tool log to include '生成角色', but got: ${systemLog?.content}`)
		CI.assert(fs.existsSync(charFile), `Character main.mjs file was not created. Expected file to exist: ${charFile}`)
		CI.assert(fs.existsSync(fountFile), `Character fount.json file was not created. Expected file to exist: ${fountFile}`)

		const mainContent = fs.readFileSync(charFile, 'utf-8')
		CI.assert(mainContent === charCode, `Character code mismatch. Expected: "${charCode}", but got: "${mainContent}"`)

		// Clean up
		fs.rmSync(charDir, { recursive: true, force: true })
	})

	CI.test('<generate-persona>', async () => {
		const personaName = 'CI_Test_Persona'
		const personaCode = 'export default { persona: "CI Test Persona" }'
		const personaDir = path.join(import.meta.dirname, '..', '..', 'reply_gener', 'functions', '..', '..', '..', '..', 'personas', personaName)
		const personaFile = path.join(personaDir, 'main.mjs')
		const fountFile = path.join(personaDir, 'fount.json')
		if (fs.existsSync(personaDir))
			fs.rmSync(personaDir, { recursive: true, force: true })

		const result = await CI.runOutput([
			`<generate-persona name="${personaName}">\n${personaCode}\n</generate-persona>`,
			'Persona generated successfully.'
		])

		const systemLog = result.logContextBefore.find(log => log.role === 'tool' && log.name === 'persona-generator')
		CI.assert(systemLog && systemLog.content.includes('生成用户人设'), `<generate-persona> failed to generate persona. Expected tool log to include '生成用户人设', but got: ${systemLog?.content}`)
		CI.assert(fs.existsSync(personaFile), `Persona main.mjs file was not created. Expected file to exist: ${personaFile}`)
		CI.assert(fs.existsSync(fountFile), `Persona fount.json file was not created. Expected file to exist: ${fountFile}`)

		const mainContent = fs.readFileSync(personaFile, 'utf-8')
		CI.assert(mainContent === personaCode, `Persona code mismatch. Expected: "${personaCode}", but got: "${mainContent}"`)

		// Clean up
		fs.rmSync(personaDir, { recursive: true, force: true })
	})
})

CI.test('Idle Management', async () => {
	await CI.test('<add-todo> and <list-todos>', async () => {
		// Clean up any existing test todo first
		await CI.runOutput(['<delete-todo>CI_Test_Todo</delete-todo>', 'Deleted.'])

		const result = await CI.runOutput([
			'<add-todo><name>CI_Test_Todo</name><content>Test todo task</content><weight>15</weight></add-todo>',
			'<list-todos></list-todos>',
			'Todo task added and listed.'
		])

		const logs = result.logContextBefore.filter(log => log.role === 'tool')
		CI.assert(logs[0].content.includes('已添加待办任务'), `<add-todo> failed. Expected log to include '已添加待办任务', but got: ${logs[0].content}`)
		CI.assert(logs[1].content.includes('CI_Test_Todo'), `<list-todos> failed to show new todo. Expected log to include 'CI_Test_Todo', but got: ${logs[1].content}`)
		CI.assert(logs[1].content.includes('权重: 15'), `<list-todos> failed to show correct weight. Expected log to include '权重: 15', but got: ${logs[1].content}`)
	})

	await CI.test('<delete-todo>', async () => {
		// Ensure the todo exists before deleting
		await CI.runOutput(['<add-todo><name>CI_Test_Todo</name><content>Test todo task</content><weight>15</weight></add-todo>', 'Added.'])

		const result = await CI.runOutput([
			'<delete-todo>CI_Test_Todo</delete-todo>',
			'<list-todos></list-todos>',
			'Todo task deleted.'
		])

		const logs = result.logContextBefore.filter(log => log.role === 'tool')
		CI.assert(logs[0].content.includes('已删除待办任务'), `<delete-todo> failed. Expected log to include '已删除待办任务', but got: ${logs[0].content}`)
		CI.assert(!logs[1].content.includes('CI_Test_Todo'), `<list-todos> showed todo after deletion. Expected log to not include 'CI_Test_Todo', but got: ${logs[1].content}`)
	})

	await CI.test('<adjust-idle-weight>', async () => {
		const result = await CI.runOutput([
			'<adjust-idle-weight><category>test_category</category><weight>5.5</weight></adjust-idle-weight>',
			'Weight adjusted.'
		])

		const systemLog = result.logContextBefore.find(log => log.role === 'tool')
		CI.assert(systemLog.content.includes('已将闲置任务类别'), `<adjust-idle-weight> failed. Expected log to include '已将闲置任务类别', but got: ${systemLog.content}`)
		CI.assert(systemLog.content.includes('5.5'), `<adjust-idle-weight> failed to set correct weight. Expected log to include '5.5', but got: ${systemLog.content}`)
	})

	await CI.test('<postpone-idle>', async () => {
		const result = await CI.runOutput([
			'<postpone-idle>2h</postpone-idle>',
			'Idle postponed.'
		])

		const systemLog = result.logContextBefore.find(log => log.role === 'tool')
		CI.assert(systemLog.content.includes('已设置下一次闲置任务'), `<postpone-idle> failed. Expected log to include '已设置下一次闲置任务', but got: ${systemLog.content}`)
		CI.assert(systemLog.content.includes('2h'), `<postpone-idle> failed to show correct duration. Expected log to include '2h', but got: ${systemLog.content}`)
	})
})

CI.test('Get Tool Info', async () => {
	const result = await CI.runOutput([
		'<get-tool-info>character-generator</get-tool-info>',
		'Tool info retrieved.'
	])

	const systemLog = result.logContextBefore.find(log => log.role === 'tool' && log.name === 'get-tool-info')
	CI.assert(!!systemLog, '<get-tool-info> did not produce a tool log. The tool log was not found in the context.')
	CI.assert(systemLog.content.includes('generate-char'), `<get-tool-info> did not return tool information. Expected log to include 'generate-char', but got: ${systemLog.content}`)
})

CI.test('Special Reply Markers', () => {
	CI.test('<-<null>-> (AI Skip)', async () => {
		const result = await CI.runOutput('<-<null>->')
		CI.assert(result === null, `<-<null>-> should return null, but got: ${JSON.stringify(result)}`)
	})

	CI.test('<-<error>-> (AI Error)', async () => {
		let errorThrown = false
		try {
			await CI.runOutput('<-<error>->')
		} catch (error) {
			errorThrown = true
		}
		CI.assert(errorThrown, '<-<error>-> should throw an error, but no error was thrown')
	})

	CI.test('Content with trailing <-<null>->', async () => {
		const result = await CI.runOutput('Some content here\n<-<null>->')
		CI.assert(result === 'Some content here', `Reply ending with <-<null>-> should be stripped, but got: ${JSON.stringify(result)}`)
	})

	CI.test('Content with trailing <-<error>->', async () => {
		let errorThrown = false
		let result = null
		try {
			result = await CI.runOutput('Some content here\n<-<error>->')
		} catch (error) {
			errorThrown = true
		}
		CI.assert(!errorThrown, 'Reply ending with <-<error>-> should not throw an error')
		CI.assert(result === 'Some content here', `Reply ending with <-<error>-> should be stripped, but got: ${JSON.stringify(result)}`)
	})
})
