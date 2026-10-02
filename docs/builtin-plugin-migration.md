# 龙胆内置功能去重与待迁移差异

## 2026-10-02 后续迁移状态

二维码预读也迁入 web-browse 的 BeforeReply：图片本地解码，结果持久化并按图片内容去重，码中的链接自动预读元信息。龙胆移除 QrcodeParserPrompt，在图片附件或二维码关键词出现时加载 web-browse。

以下原差异已迁入 fount 并接线龙胆：1 工具成功事件、成就及统计；2 可信主人提示与角色目录扩展；3 URL 元信息持久预读；4 默认 AI 总结和 summarize="false" 原文模式；5 插件专用服务源；7 保留 shell 调度并恢复后台来源标志/事件；8 无 workdir 绝对路径预读、目标机 Windows bash/WSL 路径解析；10 首轮 run-js 密钥；11 inline workspace；12 wait-screen；13 共享附件规范化。

通用接口为 `interfaces.plugins.{OnEvent,GetServiceSource,GetPrompt}`。龙胆通过 `scripts/plugin-customization.mjs` 记录成功事件；后台事件 ID 持久去重。角色配置可设 `pluginServiceSources: { 'web-browse': { AI: 'reader' }, 'web-search': { search: 'engine' } }`，未指定时继承当前 AI / 用户默认搜索源；既有 web-browse AI 配置继续有效。第 6 项原生工具继承未迁移，第 9 项按主人决定保留新版流程。

第 7 项详细说明：旧实现自行找通知频道、直接调用 GetReply 并发送结果，可能与正在进行的对话并发生成；现实现先追加事件日志，再由 shell 统一唤醒、合并与调度。来源插件、唯一事件 ID、from_timer/from_browser_js_callback 写入 extension，角色通过事件恢复统计。没有唤醒能力的频道只保存日志，之后生成时消费事件。旧计时器存储命名空间仍未自动搬迁。

下文保留最初去重时的差异记录，作为修改的来源说明；“待决定”不覆盖本节已实施状态。

对照日期：2026-10-02。fount 基线：`d96504265659a7fdce8972c133de94d4cc6d3358`。龙胆原实现基线：`6ff63a033ecc5caad2f0057e1c4d16f33912eb7f`。本文记录已经从角色移除的扩展，供主人决定是否迁入 fount；不代表已迁移。

## 当前接线

`prompt/plugin-triggers.mjs` 保留旧关键词、说话者范围、回看深度、匹配数量阈值和 `extension.enable_prompts` 入口。`scripts/builtin-plugins.mjs` 在 `buildPromptStruct` 前用 `loadPart(username, 'plugins/<name>')` 加入本次请求的 `args.plugins`。它不保存到角色的常驻插件配置；用户配置或请求显式提供的同名插件优先。

| 原角色功能 | fount 插件 | 启用方式 |
| --- | --- | --- |
| WebSearchPrompt / websearch | web-search | 原搜索关键词、webSearch、辅助模式 |
| WebBrowsePrompt / webbrowse | web-browse | 原网页关键词、webBrowse、辅助模式 |
| CodeRunnerPrompt / coderunner | code-execution | 原执行关键词、CodeRunner、辅助模式或已加载的 code_execution 扩展 |
| FileChangePrompt / file_change / 预读库 | file-operations | 原文件关键词、路径候选、fileChange、辅助模式；角色创作时也加载 |
| BrowserIntegrationPrompt / browserIntegration | browser-integration | 原浏览器关键词、browserIntegration、辅助模式 |
| TimerPrompt / timer | timer | 原计时关键词或 timer；保留 add_message 能力门槛 |
| CharGeneratorPrompt / CharGenerator / PersonaGenerator / getToolInfo | char-writing + file-operations | 原 prompt、卡、提示词、设定、角色关键词 |
| FountApiPrompt / fountApiContext | fount-api + code-execution | 原 fount/API 配置关键词 |
| Telegram / Discord 代码 API | telegram-api / discord-api + code-execution | 原桥接平台、管理关键词、粗口/情色词库触发 |
| context-compress | context-compress | 每次生成（原本无关键词门槛） |
| 子代理 / 异步任务 | sub-agent / async-task | 每次生成（原本无关键词门槛） |

工具说明、执行、BeforeReply 预读、流式预览、后台任务注册及生命周期事件都由宿主提供。上下文占用提示每轮通过插件 TweakPrompt 更新；自动压缩仍调用 fount 共享的压缩接口。角色不再注册第二份异步任务表或覆盖宿主 notifier。

旧浏览器脚本与旧计时器的角色回调地址仅保留参数转接，委托宿主插件处理。新工具创建的回调直接指向插件。旧计时器仍属于 `chars/<角色>` 的存储命名空间，新计时器属于 `plugins/timer`；宿主的列表/删除不会自动管理旧记录，需在迁移存量数据时另行处理。

## 待决定的增强和行为差异

### 1. 工具使用成就与角色统计

原 `reply_gener/functions/code-runner.mjs`、`file-change.mjs`、`web-search.mjs`、`web-browse.mjs`、`timer.mjs`、`browser-integration.mjs` 会调用角色的 `unlockAchievement`，并累加 `statisticDatas.toolUsage`，包含代码运行、文件操作、搜索、浏览、定时器设置/到期、浏览器操作/回调。通用插件没有龙胆专属的成就和计数。移除后既有数据保留，以上工具路径不再更新这些角色计数。

若迁移，宜提供通用的工具完成事件，角色订阅后记录成就/统计；明确按尝试、成功还是每个标签计数，避免因并行和重生成重复累计。不要把龙胆的成就 ID 写进通用插件。

### 2. 工具 prompt 中的主人保护和角色目录

原 CodeRunnerPrompt、FileChangePrompt、BrowserIntegrationPrompt 会根据 `logical_results.in_reply_to_master`，追加非主人使用机器、隐私及写盘的限制提示；代码与文件 prompt 还告知 `chardir`。执行器本身未以这些提示实施权限检查。

这些工具特化提示随副本删除。角色自身的主人识别与人格 prompt 仍保留。若迁移，需设计角色提供的工具使用偏好/上下文接口，而非让通用插件依赖龙胆逻辑字段。原代码 prompt 还含角色语气的内联计算、附件、摄像头、截图、下载示例，以及删除前检查目录、优先回收站/备份的建议；这些示例不再复制到角色 prompt。

### 3. 对话 URL 元信息自动预读

原 `prompt/functions/web-browse.mjs` 扫描末尾 5 条消息，提取 URL，并发读元信息；相同元信息按文本分组，对多个 URL 用公共前后缀和通配符压缩标签。通过 `processedURLs` 避免重复，在原消息的 `logContextAfter` 注入角色可见说明。

fount web-browse 插件提供主动抓取，不包含这套自动元信息预读。本次移除。若迁移，应使用幂等 BeforeReply 和持久化工具日志，给合成条目确定性 ID，避免在 GetPrompt 修改历史。二维码解析仍是角色独有功能，所用 `scripts/web/metadata.mjs`、`url.mjs` 保留；普通文本 URL 不再自动预读。

### 4. 网页浏览的专用 AI 源问答

原 `reply_gener/functions/web-browse.mjs` 抓取 Markdown 后，构建只有网页正文与问题的临时 prompt，以 `AssistantPrompt` 和 `OrderedAISourceCalling('web-browse', ...)` 调专用 AI 源，最终给父代精简答案。fount 插件把抓取正文及问题返回给当前角色，不另跑一次专用问答。

若迁移，可增加可选的网页摘要/问答 AI 源与预算配置；不应默默增加生成成本。龙胆的多用途 AI 源选路继续用于其剩余功能，原 web-browse 源配置不再被这项工具消费。

### 5. 搜索服务源覆盖与重试

原角色 `service_sources/search.mjs` 可单独选搜索源，`web-search.mjs` 用 `tryFewTimes` 执行搜索。宿主 web-search 使用用户首选的默认搜索源。本次删除角色 searchSource 配置和加载器，搜索源选择交给宿主。

若迁移，可给宿主插件增加可选源覆盖与明确的重试策略。原结果长度护栏、单行截断、人类展示层代码块包装已存在于宿主，不是待迁移增强。

### 6. 子代理继承角色原生工具

原 `reply_gener/index.mjs` 把过滤后的 `__ownReplyHandlers` 传给 `reply_gener/functions/sub-agent.mjs`；`scripts/sub-agent/runtime.mjs` 总是加入这些处理器，与子代理 plugins 属性无关。排除贴纸、角色设定过滤、工具信息与角色/人设生成，保留角色记忆、空闲管理、通知等。因此旧子代理即使显式不选文件/代码插件仍有这些原生工具。

宿主 runtime 只装配所选插件；本次删除原生处理器继承。若迁移，应设计显式、可筛选的角色工具接口，并确保 prompt 中声明的工具与实际 handler 一致。当前子代理仍继承角色 GetPrompt，人格/记忆上下文可见，但角色原生标签不能据此假定可执行。

原 runtime 另支持 `args.ai_sources[explicitName]` 注入临时 AI 源，优先于按部件名加载；宿主不支持该覆盖表。它主要用于 CI 嵌套生成，此次也移除；测试改为继承 `args.ai_source`。可考虑把覆盖表作为通用依赖注入能力。

### 7. 回调直接生成与角色级计数

原计时器和浏览器回调会选择 `UseNotifyAbleChannel`，自行调用 GetReply，再写回结果；计时器还有 `from_timer` 和平台信息，浏览器有 `from_browser_js_callback`。宿主采用追加系统条目并由 shell 安排生成，并支持定时器群回落。

本次保留旧地址转接，不保留第二套生成与通知逻辑。若需要迁移回调来源标志和角色统计，应在宿主通知条目的 extension 中规范化，避免并发重入生成。旧浏览器回调能否送达取决于宿主插件是否已登记活跃频道。

### 8. 文件预读的无 workdir 情况

旧 `scripts/file-operations/preload.mjs` 即使请求未设置 workdir，也会以 `absoluteOnly` 模式预读用户提及的绝对路径；当前宿主预读用户消息需要有 requestTarget.workdir。工具输出诊断按执行目标预读是两侧已有能力。

本次采用宿主规则。若要恢复无 workdir 的绝对路径预读，只需评估这个分支差异；路径提取去重、远程流式、文件读取窗口、编辑安全、超长输出落盘、异步预算等其余副本不应再迁入一次。宿主在路径探测、超大文件处理、secret scrub、上下文文件去重及目标机 shell 可用性上还有更新，已经随复用自动获得。

### 9. 角色/人设生成专用 XML 标签

旧 `<get-tool-info>` 按需返回完整模板与类型声明，`<generate-char name="...">` / `<generate-persona name="...">` 一次写 main.mjs 与 fount.json，拒绝覆盖已存在的 main.mjs。宿主 char-writing 提供资料目录、样例与创作流程，实际写入通过 file-operations。

这些旧标签已移除。若需要迁移单次创建能力，可以设计通用部件创建工具，检查整个目标目录是否已存在，并同时校验 main.mjs 与 manifest；无需继续维护 prompt 中的大段旧模板。

### 10. fount API 密钥生命周期

原角色在 JS 上下文首次建立时通过 `ensureApiKey` 申请并保存自己的 `config.fountApiKey`。宿主按角色 ID 存在 `plugins/fount-api.apikeys`，由插件的内容 handler 申请。角色旧字段此次不再读写；已存密钥不自动撤销，也不复制到插件配置。

若需迁移存量密钥，考虑一次性配置迁移；若要让第一轮 run-js 即可拿到新密钥，需要评估宿主现有 handler 的执行顺序，而非在角色里再实现一套申请逻辑。

### 11. inline-js 共享运行上下文

旧 `reply_gener/functions/code-runner.mjs` 的 `evaluateInlineJs` 向内联求值注入 `workspace`、`chat_log` 和本机 `workdir`，因此内联标签能直接读取此前 run-js 写入的变量。当前宿主内联 JS 提供收集 console 和本机 workdir，但不提供 workspace/chat_log；run-js 自身仍跨轮共享 workspace。

本次采用宿主行为，不保留内联上下文增强。若迁移，考虑让 run-js 与 inline-js 共用上下文构造器，同时明确哪些回调/附件能力适合早期 streaming evaluate，避免重复副作用。角色测试改为用第二次 run-js 验证共享 workspace。

### 12. wait-screen 标签

旧代码执行器另注册 `<wait-screen>秒数</wait-screen>`，等待后捕获屏幕，以 `code-execution.wait-screen` 工具日志附上图片；旧代码 prompt 推荐在影响屏幕的操作后追加此标签。当前 fount code-execution 没有这个 handler。

本次删除标签及其说明。角色自身按关键词触发的 ScreenshotPrompt 保留。若迁移，应在宿主新增截图工具或 code-execution 的可选截图后处理，并明确目标机器、图像附件与无显示环境的行为。

### 13. 代码工具的附件规范化

旧 run-js 的 view_files/add_files 使用角色 `scripts/file-obj.mjs`：结合内容与文件名检测 MIME，并通过 URL/Content-Disposition 推导下载文件名。当前宿主 code-execution 内的文件对象转换更简化，本地路径默认 application/octet-stream，URL 文件名主要来自 pathname。

本次让代码工具采用宿主转换；角色剪贴板仍需要自己的 file-obj/mime-type/URL helper，所以这些文件保留。若迁移，可把更完整的附件转换做成宿主共享函数，让代码执行器与其他生产附件的部件复用。

## 保留的角色独有功能

人格、主人识别、记忆、贴纸、闲置/Todo、Reality Channel、语音哨兵、剪贴板、摄像头/截图主动感知、二维码、数学预计算、掷骰/猜拳/塔罗、诗歌/语法/提示词特化、通知及 AI 源选路仍在角色中。当前 fount 插件没有对应完整实现，不能仅因 code-execution 能调用任意 JS 就视为已内置。

`dist/` 是被忽略的既有构建产物，本次修改源代码；发布时需按原发布流程重新构建，避免继续分发旧副本。
