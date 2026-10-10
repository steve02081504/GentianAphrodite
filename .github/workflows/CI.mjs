import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'

/* global fountCharCI */
const CI = fountCharCI

await CI.test('Distribution build injects flags before tree shaking', async () => {
	const { rollup } = await import('npm:rollup')
	const { distFlagsPlugin } = await import('../../.esh/commands/build-dist-flags.mjs')
	const root = path.resolve(import.meta.dirname, '../..')
	const charBasePath = path.join(root, 'charbase.mjs')
	const version = 'v0.1.5.20'
	const entryId = '\0dist-flags-test'
	const bundle = await rollup({
		input: entryId,
		/**
		 * 保留宿主模块为外部依赖。
		 * @param {string} id 模块标识。
		 * @returns {boolean} 是否外部依赖。
		 */
		external: id => id.startsWith('node:') || id.startsWith('npm:') || id.endsWith('/src/server/base.mjs'),
		treeshake: { moduleSideEffects: false },
		plugins: [
			{
				name: 'distribution-test-entry',
				/**
				 * 解析虚拟入口。
				 * @param {string} id 模块标识。
				 * @returns {string|null} 入口标识。
				 */
				resolveId(id) { return id === entryId ? id : null },
				/**
				 * 加载虚拟入口。
				 * @param {string} id 模块标识。
				 * @returns {string|null} 测试入口源码。
				 */
				load(id) {
					if (id !== entryId) return null
					return `export { is_dist, charvar } from ${JSON.stringify(charBasePath)};
export { GetPromptForOther } from ${JSON.stringify(path.join(root, 'prompt/role_settings/for-other.mjs'))};`
				},
			},
			distFlagsPlugin(version, charBasePath),
		],
	})
	try {
		const { output } = await bundle.generate({ format: 'esm' })
		// data URL 没有 dirname，提供实际构建目录供 charbase 的路径初始化使用。
		const code = output[0].code.replaceAll('import.meta.dirname', JSON.stringify(root))
		const built = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
		CI.assert(built.is_dist === true, 'Built character must enable distribution mode.')
		CI.assert(built.charvar === version, 'Built character must use the release version without invoking git.')
		CI.assert((await built.GetPromptForOther({})).encrypted === true, 'Tree shaking must retain prompt privacy in the built character.')
		CI.assert(fs.readFileSync(charBasePath, 'utf8').includes('export const is_dist = false'), 'Build must preserve development mode in source.')
	}
	finally {
		await bundle.close()
	}
})

await CI.test('Reality Channel History excludes bootstrap examples', async () => {
	const { RealityChannel, initRealityChannel } = await import('../../event_engine/reality-channel.mjs')
	const { RealityChannelHistoryPrompt } = await import('../../prompt/memory/reality-channel-history.mjs')
	initRealityChannel()
	const original = RealityChannel.chat_log
	try {
		RealityChannel.chat_log = original.filter(entry => entry.type === 'reality-bootstrap')
		const empty = await RealityChannelHistoryPrompt({}, {})
		CI.assert(empty.text.length === 0, 'Bootstrap examples should not be injected as real activity.')
		RealityChannel.chat_log = [...RealityChannel.chat_log, { name: 'system', role: 'system', content: 'actual reality activity' }]
		const active = await RealityChannelHistoryPrompt({}, {})
		CI.assert(active.text[0].content.includes('actual reality activity'), 'Actual activity must remain visible.')
		CI.assert(!active.text[0].content.includes('测试通知'), 'Bootstrap notification leaked into activity history.')
		const own = await RealityChannelHistoryPrompt({ extension: { is_reality_channel: true } }, {})
		CI.assert(own.text.length === 0, 'Reality channel must not repeat its own history.')
	}
	finally {
		RealityChannel.chat_log = original
	}
})

await CI.test('noAI Fallback', async () => {
	await CI.char.interfaces.config.SetData({ AIsources: {} })
	await CI.runOutput()
})

await CI.test('Setup AI Source', async () => {
	await CI.char.interfaces.config.SetData({
		AIsources: { CI: 'CI' },
		plugins: [],
		disable_idle_event: true
	})
})

await CI.test('Keyword Host Plugin Migration', async () => {
	const cases = [
		['算一下', {}, 'code-execution'],
		['浏览网页', {}, 'web-browse'],
		['搜索', {}, 'web-search'],
		['浏览器', {}, 'browser-integration'],
		['提醒我', {}, 'timer'],
		['角色设定', {}, 'char-writing'],
		['fount', {}, 'fount-api'],
		['你好', { enable_prompts: { fileChange: true } }, 'file-operations'],
	]
	for (const [content, extension, name] of cases) {
		const { prompt_struct } = await CI.runInput(content, { extension })
		CI.assert(prompt_struct.plugin_prompts[name], `Trigger did not load ${name} before building the prompt.`)
		if (name === 'fount-api') CI.assert(prompt_struct.plugin_prompts['code-execution'], 'fount API requires host code execution.')
	}
	const { prompt_struct: idle } = await CI.runInput('你好')
	CI.assert(!idle.plugin_prompts['web-search'] && !idle.plugin_prompts['code-execution'], 'Keyword plugins leaked into a later request.')
	CI.assert(CI.char.interfaces.config.GetData().plugins.length === 0, 'Triggers must not persist into character config.')
	const result = await CI.runOutput('answer: <inline-js>21 * 2</inline-js>', {
		extension: { enable_prompts: { CodeRunner: true } },
	})
	CI.assert((result.content_for_show ?? result.content).includes('42'), 'Host inline handler did not execute.')
})

await CI.test('Plugin Trigger Selection', async () => {
	const { selectBuiltinPlugins, selectPlatformPlugin } = await import('../../prompt/plugin-triggers.mjs')
	/**
	 * 测试替身按范围/深度匹配，不依赖翻译服务与运行中的服务器。
	 * @param {object} args 请求。
	 * @param {(string|RegExp)[]} keys 关键词。
	 * @param {'user'|'other'|'any'} from 说话者范围。
	 * @param {number} [depth=4] 回看深度。
	 * @returns {Promise<number>} 匹配数量。
	 */
	const matchKeys = async (args, keys, from, depth = 4) => {
		const logs = args.chat_log.slice(-depth).filter(entry =>
			from === 'user' ? entry.uid === args.UserUid : from === 'other' ? entry.uid !== args.UserUid && entry.uid !== args.CharUid : true,
		)
		return keys.filter(key => logs.some(entry => key instanceof RegExp ? key.test(entry.content) : entry.content.includes(key))).length
	}
	/**
	 * 构造请求。
	 * @param {string} content 用户消息。
	 * @param {object} [overrides={}] 请求覆盖。
	 * @returns {object} 测试请求。
	 */
	const request = (content, overrides = {}) => ({ chat_log: [{ uid: 'user', content }], UserUid: 'user', CharUid: 'char', supported_functions: { add_message: true }, ...overrides })
	const deps = {
		matchKeys,
		/**
		 * 提取测试文件路径。
		 * @param {string} text 消息文本。
		 * @returns {object[]} 路径候选。
		 */
		extractPathCandidates: text => /C:\\project\\main.mjs/.test(text) ? [{ path: text }] : [],
		/**
		 * 获取测试聊天记录。
		 * @param {object} args 请求。
		 * @returns {object[]} 聊天记录。
		 */
		getScopedChatLog: args => args.chat_log,
	}

	CI.assert(
		JSON.stringify(await selectBuiltinPlugins(request('你好'), {}, deps)) === JSON.stringify(['context-compress', 'sub-agent', 'async-task']),
		'Ordinary conversation must only keep formerly unconditional plugins.'
	)
	for (const [text, name] of [
		['搜索', 'web-search'], ['https://example.com', 'web-browse'], ['运行代码', 'code-execution'],
		['文件', 'file-operations'], ['浏览器', 'browser-integration'], ['提醒我', 'timer'], ['fount', 'fount-api'],
	]) CI.assert((await selectBuiltinPlugins(request(text), {}, deps)).includes(name), `Legacy keyword ${text} must activate ${name}.`)
	for (const [key, name] of [
		['webSearch', 'web-search'], ['webBrowse', 'web-browse'], ['CodeRunner', 'code-execution'],
		['fileChange', 'file-operations'], ['browserIntegration', 'browser-integration'], ['timer', 'timer'],
	]) CI.assert((await selectBuiltinPlugins(request('你好', { extension: { enable_prompts: { [key]: true } } }), {}, deps)).includes(name), `enable_prompts.${key} must activate ${name}.`)

	CI.assert(!(await selectBuiltinPlugins(request('提醒我', { supported_functions: {} }), {}, deps)).includes('timer'), 'timer must require add_message capability.')
	CI.assert(!(await selectBuiltinPlugins(request('打开'), {}, deps)).includes('code-execution'), 'Single user keyword must not reach the code threshold.')
	CI.assert((await selectBuiltinPlugins(request('打开桌面'), {}, deps)).includes('code-execution'), 'Two user keywords must reach the code threshold.')
	CI.assert(!(await selectBuiltinPlugins(request('修改'), {}, deps)).includes('file-operations'), 'Single user keyword must not reach the file threshold.')
	CI.assert((await selectBuiltinPlugins(request('新建修改'), {}, deps)).includes('file-operations'), 'Two user keywords must reach the file threshold.')
	CI.assert(!(await selectBuiltinPlugins(request('打开桌面', { chat_log: [{ uid: 'char', content: '打开桌面' }] }), {}, deps)).includes('code-execution'), 'Character speech must not count toward the user threshold.')
	CI.assert((await selectBuiltinPlugins(request('C:\\project\\main.mjs'), {}, deps)).includes('file-operations'), 'Path mentions must supply file operations.')
	const writing = await selectBuiltinPlugins(request('角色设定'), {}, deps)
	CI.assert(writing.includes('char-writing') && writing.includes('file-operations'), 'Character writing must supply char-writing and file-operations.')
	CI.assert(writing.length === new Set(writing).size, 'Selected plugins must be unique.')
	const isolated = request('你好')
	const snapshot = structuredClone(isolated)
	const assist = await selectBuiltinPlugins(isolated, { in_assist: true }, deps)
	for (const name of ['code-execution', 'file-operations', 'web-search', 'web-browse', 'browser-integration'])
		CI.assert(assist.includes(name), `Assist mode must include ${name}.`)
	CI.assert(JSON.stringify(isolated) === JSON.stringify(snapshot), 'Selection must not mutate the request.')

	const platformDeps = { matchKeys, rudeWords: ['粗口'], lewdWords: ['情色'] }
	for (const platform of ['telegram', 'discord']) {
		const args = request('禁言', { extension: { chat: { bridge: { platform } } } })
		CI.assert(await selectPlatformPlugin(args, platformDeps) === `${platform}-api`, `${platform} management keyword must select its API plugin.`)
		args.chat_log = [{ uid: 'user', content: '禁言' }, ...Array.from({ length: 3 }, () => ({ uid: 'user', content: '你好' }))]
		CI.assert(await selectPlatformPlugin(args, platformDeps) === null, `${platform} keyword outside lookback depth must not trigger.`)
		args.chat_log = [{ uid: 'user', content: '情色' }]
		CI.assert(await selectPlatformPlugin(args, platformDeps) === null, `${platform} lewd word from user must not trigger.`)
		args.chat_log = [{ uid: 'other', content: '情色' }]
		CI.assert(await selectPlatformPlugin(args, platformDeps) === `${platform}-api`, `${platform} lewd word from others must trigger.`)
	}
	CI.assert(await selectPlatformPlugin(request('禁言'), platformDeps) === null, 'Management keyword without a bridge platform must not trigger.')
})

await CI.test('Enable Plugins for Tool Contract Tests', async () => {
	await CI.char.interfaces.config.SetData({ plugins: ['code-execution', 'file-operations', 'web-search', 'web-browse', 'timer', 'browser-integration'] })
})

await CI.test('Plugin Events and Role Statistics', async () => {
	const { statisticDatas } = await import('../../scripts/statistics.mjs')
	const before = statisticDatas.toolUsage.codeRuns || 0
	const result = await CI.runOutput('<inline-js>6 * 7</inline-js>')
	CI.assert((result.content_for_show ?? result.content).includes('42'), 'Inline JS did not execute.')
	CI.assert(statisticDatas.toolUsage.codeRuns === before + 1, 'Successful host tool did not update role statistics.')
	const event = { id: `CI-timer-${crypto.randomUUID()}`, pluginName: 'timer', type: 'background', status: 'succeeded', tool: 'timer.callback' }
	const callbacks = statisticDatas.toolUsage.timerCallbacks || 0
	await CI.char.interfaces.plugins.OnEvent(event, {})
	await CI.char.interfaces.plugins.OnEvent(event, {})
	CI.assert(statisticDatas.toolUsage.timerCallbacks === callbacks + 1, 'Background replay was counted twice.')
	await CI.char.interfaces.plugins.OnEvent({ ...event, id: `failed-${event.id}`, status: 'failed' }, {})
	CI.assert(statisticDatas.toolUsage.timerCallbacks === callbacks + 1, 'Failed background event must not count.')
})

CI.test('Request-level AI Source (args.ai_source)', async () => {
	const stubAI = {
		filename: 'stub-ai',
		/**
		 * 返回固定文本以验证请求级 AI 源覆盖。
		 * @returns {Promise<object>} 固定回复。
		 */
		async StructCall() {
			return { content: 'AI_SOURCE_OVERRIDE_TOKEN', extension: {}, files: [] }
		}
	}
	const { reply } = await CI.runInput('hello', { ai_source: stubAI })
	CI.assert(reply.content.includes('AI_SOURCE_OVERRIDE_TOKEN'), `args.ai_source was not consumed. Expected reply to include 'AI_SOURCE_OVERRIDE_TOKEN', but got: ${JSON.stringify(reply)}`)
})

CI.test('Role Setting Filter', async () => {
	const result = await CI.runOutput('我将扮演龙胆·阿芙萝黛蒂，一个年仅27岁的米洛普斯族幼态长生种。')
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

	CI.test('<replace-file> replaceAll', async () => {
		const testFilePath = path.join(CI.context.workSpace.path, 'replace_all_test.txt')
		fs.writeFileSync(testFilePath, 'foo foo foo', 'utf-8')
		const replaceXML = `\
<replace-file>
	<file path="${testFilePath}">
		<replacement replaceAll="true">
			<search>foo</search>
			<replace>bar</replace>
		</replacement>
	</file>
</replace-file>
`
		await CI.runOutput([replaceXML, 'Replaced all.'])
		const newContent = fs.readFileSync(testFilePath, 'utf-8')
		CI.assert(newContent === 'bar bar bar', `<replace-file replaceAll> failed. Expected 'bar bar bar', but got: '${newContent}'`)
	})

	CI.test('<replace-file> uniqueness guard', async () => {
		const testFilePath = path.join(CI.context.workSpace.path, 'replace_guard_test.txt')
		const original = 'dup\ndup\n'
		fs.writeFileSync(testFilePath, original, 'utf-8')
		const replaceXML = `\
<replace-file>
	<file path="${testFilePath}">
		<replacement>
			<search>dup</search>
			<replace>x</replace>
		</replacement>
	</file>
</replace-file>
`
		await CI.runOutput([replaceXML, 'Attempted.'])
		const newContent = fs.readFileSync(testFilePath, 'utf-8')
		CI.assert(newContent === original, `<replace-file> uniqueness guard failed: ambiguous match should be rejected, but file became '${newContent}'`)
	})

	CI.test('<override-file> force', async () => {
		const testFilePath = path.join(CI.context.workSpace.path, 'override_force_test.txt')
		fs.writeFileSync(testFilePath, 'original content here', 'utf-8')
		await CI.runOutput([`<override-file path="${testFilePath}" force="true">totally different</override-file>`, 'Overridden with force.'])
		const newContent = fs.readFileSync(testFilePath, 'utf-8')
		CI.assert(newContent.trim() === 'totally different', `<override-file force> failed. Expected 'totally different', but got: '${newContent.trim()}'`)
	})

	CI.test('<view-file> pagination', async () => {
		const testFilePath = path.join(CI.context.workSpace.path, 'view_page_test.txt')
		fs.writeFileSync(testFilePath, 'line1\nline2\nline3\nline4\nline5', 'utf-8')
		const result = await CI.runOutput([`<view-file offset="2" limit="2">${testFilePath}</view-file>`, 'Read a page.'])
		const log = result.logContextBefore.find(entry => entry.role === 'tool' && entry.name === 'file-operations.view-file')
		CI.assert(log && log.content.includes('line2') && log.content.includes('line3'), `<view-file> pagination failed to include requested lines. Log: ${log?.content}`)
		CI.assert(log && !log.content.includes('line5'), `<view-file> pagination leaked out-of-window content. Log: ${log?.content}`)
	})

	CI.test('<glob>', async () => {
		const dir = path.join(CI.context.workSpace.path, 'glob_dir')
		fs.mkdirSync(dir, { recursive: true })
		fs.writeFileSync(path.join(dir, 'a_unique_glob.txt'), 'x', 'utf-8')
		const result = await CI.runOutput([`<glob path="${dir}">**/*.txt</glob>`, 'Found files.'])
		const log = result.logContextBefore.find(entry => entry.role === 'tool' && entry.name === 'file-operations.glob')
		CI.assert(log && log.content.includes('a_unique_glob.txt'), `<glob> failed to find file. Log: ${log?.content}`)
	})

	CI.test('<grep>', async () => {
		const testFilePath = path.join(CI.context.workSpace.path, 'grep_test.txt')
		fs.writeFileSync(testFilePath, 'alpha\nCI_GREP_UNIQUE_TOKEN\nbeta', 'utf-8')
		const result = await CI.runOutput([`<grep path="${CI.context.workSpace.path}" include="grep_test.txt">CI_GREP_UNIQUE_TOKEN</grep>`, 'Searched content.'])
		const log = result.logContextBefore.find(entry => entry.role === 'tool' && entry.name === 'file-operations.grep')
		CI.assert(log && log.content.includes('CI_GREP_UNIQUE_TOKEN'), `<grep> failed to find matching content. Log: ${log?.content}`)
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
			const shown = result.content_for_show ?? result.content
			CI.assert(shown === 'The result is hello from pwsh.', `<inline-pwsh> failed to execute and replace content. Expected: 'The result is hello from pwsh.', but got: '${shown}'`)
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
		// 新管线把 inline 结果放入展示层（content_for_show）并回执 inline-rendered 工具日志，不再改写 content
		const shown = result.content_for_show ?? result.content
		CI.assert(shown === 'The result of 5 * 8 is 40.', `<inline-js> failed to execute and replace content. Expected: 'The result of 5 * 8 is 40.', but got: '${shown}'`)
	})

	CI.test('<run-js> with workspace', async () => {
		const result = await CI.runOutput([
			'<run-js>workspace.testVar = "Success";</run-js>',
			'<run-js>console.log(workspace.testVar)</run-js>',
			'Workspace read.',
		])
		const logs = result.logContextBefore.filter(entry => entry.role === 'tool' && entry.name === 'code-execution.run-js')
		CI.assert(logs.some(entry => entry.content.includes('Success')), 'Host run-js should retain workspace across tool rounds.')
	})

	CI.test('<run-js> with callback', async () => {
		// callback 现在只做 appendAndWake（不自行重入生成），因此不再需要额外的第三步输出
		const result = await CI.runOutput([
			'<run-js>callback("test", new Promise(resolve => setTimeout(resolve, 1000)).then(() => globalThis.callbacked = true))</run-js>',
			'promise callback setted.'
		])
		CI.assert(result.content === 'promise callback setted.', `<run-js> failed to use the callback. Expected: 'promise callback setted.', but got: '${result.content}'`)
		await CI.wait(() => globalThis.callbacked)
		CI.assert(globalThis.callbacked, `<run-js> failed to callback. Expected globalThis.callbacked to be true, but it was ${globalThis.callbacked}`)
		delete globalThis.callbacked
	})
})

CI.test('Web Search', async () => {
	const result = await CI.runOutput(['<web-search>fount framework steve02081504</web-search>', 'Search complete.'])
	const systemLog = result.logContextBefore.find(log => log.role === 'tool' && log.content.includes('搜索结果'))
	CI.assert(!!systemLog, '<web-search> did not produce a tool log with search results. The tool log was not found in the context.')
})

CI.test('Web Browse', async () => {
	const { router, url, root } = CI.context.http
	const webContent = /* html */ '<html><body><h1>Test Page</h1><p>This is a test paragraph for the CI.</p></body></html>'

	router.get(root, (req, res) => {
		res.writeHead(200, { 'Content-Type': 'text/html' })
		res.end(webContent)
	})

	const result = await CI.runOutput([
		`<web-browse summarize="false"><url>${url}</url><question>What is in the paragraph?</question></web-browse>`,
		result => {
			CI.assert(result.prompt_single.includes('This is a test paragraph for the CI'), `<web-browse> failed to process web content. Expected prompt_single to include 'This is a test paragraph for the CI', but got: ${result.prompt_single}`)
			CI.assert(result.prompt_single.includes('What is in the paragraph?'), `<web-browse> failed to process question. Expected prompt_single to include 'What is in the paragraph?', but got: ${result.prompt_single}`)
			return 'The paragraph says: This is a test paragraph for the CI.'
		},
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
		'Timer test sequence complete.'
	])
	const logs = result.logContextBefore.filter(log => log.role === 'tool')
	CI.assert(logs[0].content.replace(/\s/g, '').includes('已设置1个定时器'), `set-timer failed. Expected log to include '已设置1个定时器', but got: ${logs[0].content}`)
	CI.assert(logs[1].content.includes('CI_Test_Timer'), `list-timers failed to show new timer. Expected log to include 'CI_Test_Timer', but got: ${logs[1].content}`)
	CI.assert(logs[2].content.includes('已删除'), `remove-timer failed. Expected log to include '已成功删除定时器', but got: ${logs[2].content}`)
	CI.assert(logs[3].content.includes('无'), `list-timers showed timer after deletion. Expected log to include '无', but got: ${logs[3].content}`)
	CI.assert(result.content === 'Timer test sequence complete.', `Final message not found. Expected: 'Timer test sequence complete.', but got: '${result.content}'`)

})

CI.test('Sub Agent', () => {
	CI.test('<list-ai-sources>', async () => {
		const result = await CI.runOutput(['<list-ai-sources></list-ai-sources>', 'AI sources listed.'])
		const log = result.logContextBefore.find(entry => entry.role === 'tool' && entry.name === 'sub-agent.list-ai-sources')
		CI.assert(!!log, '<list-ai-sources> did not produce a tool log.')
	})

	CI.test('<run-subagent> sync', async () => {
		// 用请求级临时 AI 源（独立输出队列）供子代理使用，避免子代与父代争抢 mock 输出队列
		const { reply: result } = await CI.runInput('Delegate this task', {
			ai_source: CI.createAISource([
				'<run-subagent plugins="sub-agent,async-task" round-limit="2" time-limit="30s">Reply with the single word: done</run-subagent>',
				'done', 'Sub-agent finished.',
			]),
		})
		const log = result.logContextBefore.find(entry => entry.role === 'tool' && entry.name === 'sub-agent.run')
		CI.assert(!!log, '<run-subagent> did not produce a tool log.')
	})

	CI.test('<run-subagent> requires round-limit/time-limit', async () => {
		const result = await CI.runOutput([
			'<run-subagent>Missing limits</run-subagent>',
			'Rejected.'
		])
		const log = result.logContextBefore.find(entry => entry.role === 'tool' && entry.name === 'sub-agent.run')
		CI.assert(!!log && log.content.includes('round-limit'), `<run-subagent> without limits should be rejected with a hint. Log: ${log?.content}`)
	})
})

CI.test('Async Task', () => {
	CI.test('<list-async> empty', async () => {
		const result = await CI.runOutput(['<list-async></list-async>', 'Listed.'])
		const log = result.logContextBefore.find(entry => entry.role === 'tool' && entry.name === 'async-task.list')
		CI.assert(!!log, '<list-async> did not produce a tool log.')
	})

	CI.test('<await-async> unknown id', async () => {
		const result = await CI.runOutput(['<await-async ids="no-such-task"></await-async>', 'Awaited.'])
		const log = result.logContextBefore.find(entry => entry.role === 'tool' && entry.name === 'async-task.await')
		CI.assert(!!log && log.content.includes('未找到'), `<await-async> with unknown id should report not-found. Log: ${log?.content}`)
	})
})

CI.test('Preload Mentioned Files', () => {
	CI.test('preloads a path mentioned in the user message', async () => {
		const testFilePath = path.join(CI.context.workSpace.path, 'preload_mention_test.txt')
		fs.writeFileSync(testFilePath, 'PRELOAD_UNIQUE_TOKEN', 'utf-8')
		// 预读扫描的是“用户消息”中的路径，因此用 runInput 构造用户消息
		const { reply } = await CI.runInput(`Please look at ${testFilePath}`, { workdir: { machine: '0', path: CI.context.workSpace.path } })
		const log = reply.logContextBefore.find(entry => entry.role === 'tool' && entry.name === 'file-operations.preload')
		CI.assert(!!log && log.content.includes('PRELOAD_UNIQUE_TOKEN'), `preload did not inject the mentioned file. Log: ${log?.content}`)
	})
})

CI.test('Character Writing Plugin', async () => {
	const { prompt_struct } = await CI.runInput('创建一个角色设定')
	CI.assert(prompt_struct.plugin_prompts['char-writing']?.text.some(item => item.content.includes('charAPI.ts')), 'Character writing should load host documentation.')
	CI.assert(prompt_struct.plugin_prompts['file-operations'], 'Character writing requires file operations.')
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
		const result = await CI.runOutput('Some content here <-<null>->')
		CI.assert(result.content === 'Some content here', `Reply ending with <-<null>-> should be stripped, but got: ${JSON.stringify(result)}`)
	})

	CI.test('Content with trailing <-<error>->', async () => {
		let errorThrown = false
		let result = null
		try {
			result = await CI.runOutput('Some content here <-<error>->')
		} catch (error) {
			errorThrown = true
		}
		CI.assert(!errorThrown, 'Reply ending with <-<error>-> should not throw an error')
		CI.assert(result.content === 'Some content here', `Reply ending with <-<error>-> should be stripped, but got: ${JSON.stringify(result)}`)
	})
})

CI.test('Sticker Manifest', () => {
	const stickerDir = path.join(import.meta.dirname, '..', '..', 'public', 'imgs', 'stickers')
	const assetNames = fs.readdirSync(stickerDir)
		.filter(name => name.endsWith('.avif'))
		.map(name => name.slice(0, -'.avif'.length))
		.sort()

	const telegramStickers = CI.char.interfaces.telegram.stickers
	/**
	 *
	 * @param {string[]} keys 键集合
	 * @returns {string[]} 排序后的键
	 */
	const sortedKeys = keys => [...keys].sort()
	const fileIds = Object.values(telegramStickers).map(sticker => sticker.fileId)
	const duplicateFileIds = [...new Set(fileIds.filter((fileId, index) => fileIds.indexOf(fileId) !== index))]
	CI.assert(duplicateFileIds.length === 0, `Telegram 贴纸 fileId 重复：${duplicateFileIds.join(', ')}`)
	CI.assert(
		JSON.stringify(sortedKeys(Object.keys(telegramStickers))) === JSON.stringify(assetNames),
		`Telegram 贴纸键与 public/imgs/stickers 资源不一致。仅 manifest 有：${Object.keys(telegramStickers).filter(key => !assetNames.includes(key)).join(', ')}；仅资源有：${assetNames.filter(name => !(name in telegramStickers)).join(', ')}`
	)
	CI.assert(
		JSON.stringify(sortedKeys(Object.keys(CI.char.interfaces.discord.stickers))) === JSON.stringify(assetNames),
		`Discord 贴纸键与 public/imgs/stickers 资源不一致。仅资源有：${assetNames.filter(name => !(name in CI.char.interfaces.discord.stickers)).join(', ')}`
	)
})
