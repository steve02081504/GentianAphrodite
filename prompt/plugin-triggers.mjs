/**
 * 旧功能入口只选择宿主插件，不提供工具实现或工具说明。
 * @param {object} args 回复请求。
 * @param {object} logicalResults 角色逻辑结果。
 * @param {object} deps 关键词匹配与路径候选提取。
 * @param {Function} deps.matchKeys 保留角色的匹配范围、深度与翻译规则。
 * @param {Function} deps.extractPathCandidates 宿主路径候选提取器。
 * @param {Function} deps.getScopedChatLog 角色限定范围的聊天记录。
 * @returns {Promise<string[]>} 本次请求需要的宿主插件名。
 */
export async function selectBuiltinPlugins(args, logicalResults, { matchKeys, extractPathCandidates, getScopedChatLog }) {
	const selected = new Set(['context-compress', 'sub-agent', 'async-task'])
	const enabled = args.extension?.enable_prompts || {}
	/**
	 * 按原请求匹配关键词。
	 * @param {...any} params 关键词、范围和回看深度。
	 * @returns {Promise<number>} 匹配数量。
	 */
	const match = (...params) => matchKeys(args, ...params)
	if (enabled.webSearch || logicalResults.in_assist || await match(['搜索', '查找', '查询', /(查|搜|搜索).{0,3}下/, /有(哪些|什么|没有)/, '怎样', '如何', '帮我搜'], 'any'))
		selected.add('web-search')
	if (enabled.webBrowse || logicalResults.in_assist || getScopedChatLog(args, 'both').slice(-20).some(entry => entry.files?.some(file => file?.mime_type?.startsWith('image/'))) || await match(['浏览', '访问', '二维码', /qrcode|qr code/i, /https?:\/\//, '查看网页', /<web-browse>/i], 'any'))
		selected.add('web-browse')
	if (enabled.browserIntegration || logicalResults.in_assist || await match([
		'browser', 'page', 'tab', '网页', '页面', '标签页', '浏览器', '网站', '站点',
		'autorun', 'userscript', '自动运行', '用户脚本', /<browser-.*>/i,
	], 'any')) selected.add('browser-integration')
	if (await match(['prompt', '卡', '提示词', '设定', '角色'], 'any')) {
		selected.add('char-writing')
		selected.add('file-operations')
	}
	if (args.supported_functions?.add_message && (enabled.timer || await match([
		/(定|计)时器/, '闹钟', '提醒我', '设置提醒', /到时间?提醒我/, /过(多久|一?阵)提醒我/, 'schedule', 'timer',
		/(周|天|月|星期|小时|分|时辰|年|秒)后/, /<timer>/i, /每.{0,3}(周|天|月|星期|小时|分|时辰|年|秒)/i,
	], 'any'))) selected.add('timer')
	if (await match(['fount', /[用走]api/], 'any') || (
		(logicalResults.in_assist || await match(['配置', '修复', '设置', '更改', '功能', 'config'], 'any')) &&
		await match(['fount', '角色', 'AI源', 'API', 'shell'], 'any')
	)) selected.add('fount-api')
	const logText = getScopedChatLog(args, 'both').map(entry => entry.content).join('\n')
	if (enabled.fileChange || extractPathCandidates(logText).length || logicalResults.in_assist || await match([
		'文件', /<\/?(view|replace|override)-file|<\/?glob|<\/?grep/i, 'error', /Error/, /file:\/\//,
	], 'any') || await match([
		'查看', '浏览', '替换', '修改', '新建', '创建', '写入', '文件', '读取', '搜索', '查找', /\.[A-Za-z]{2,4}/,
	], 'user') >= 2) selected.add('file-operations')
	if (enabled.CodeRunner || logicalResults.in_assist || await match([
		/(执行|运行|调用|(指|命)令|代码){2}/,
		/代码(执行|运行)能力/, /(pwsh|powershell|bash|js)代码(执行|运行)/i, /(执行|运行)(pwsh|powershell|bash|js)代码/i,
		'是多少', '是几', '算一下', '算下', /[=＝][?？]/, /run-(js|pwsh|bash)/i, /inline-(js|pwsh|bash)/i,
		/发给?我/, /发(|出|过)来/, /发.*群里/, /[A-Za-z](:\/|盘)/,
	], 'any') || await match([
		'创建', '打开', '桌面', '文档', '文件', '看看', '看下', '播放', '回收站', '摄像头', '计算机', '拍照', '录像', '打印', '读取', '电脑', '查看', '来个',
		/来.{0,3}bgm/i, /放(首|个)歌/,
	], 'user') >= 2) selected.add('code-execution')
	return [...selected]
}

/**
 * 平台 API 保留原来的关键词、说话者范围和回看深度。
 * @param {object} args 回复请求。
 * @param {object} deps 匹配器与角色词库。
 * @param {Function} deps.matchKeys 关键词匹配器。
 * @param {Array} deps.rudeWords 粗口词库。
 * @param {Array} deps.lewdWords 情色词库。
 * @returns {Promise<string|null>} 平台插件名。
 */
export async function selectPlatformPlugin(args, { matchKeys, rudeWords, lewdWords }) {
	const platform = args.extension?.chat?.bridge?.platform
	if (!['telegram', 'discord'].includes(platform)) return null
	const keywords = [
		'身份组', '群', '频道', '设置', '服务器', 'ban', '踢了', '禁言',
		'管理', '操作', '权限', '置顶', '分区', '分组', '帖子', '表情', '贴纸',
		'修改', '封禁', '邀请', /生成{0,3}链接/, '话题', '投票', '动态', '匿名', '删了', '删掉',
		...platform === 'telegram' ? ['tg', 'telegram', 'https://t.me/'] : ['反应', 'discord', 'https://discord.com/'],
	]
	return await matchKeys(args, rudeWords, 'any', 6) || await matchKeys(args, lewdWords, 'other', 3) ||
		await matchKeys(args, keywords, 'any', 3) ? `${platform}-api` : null
}
