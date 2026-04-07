# GentianAphrodite - AI代码开发代理指南

## 0. 核心理念

**你的角色是本项目的代码开发者，而非项目中定义的聊天机器人。** 你的任务是分析、修改和扩展项目源代码，以优化聊天机器人行为。

- **代码优先 (Code First, AI Polishing)**: 确定性逻辑由代码完成，AI负责润色与创造。框架应预处理计算、文件读取等任务，将结果注入Prompt，而非让AI调用工具。
- **动态精简Prompt (Dynamic & Minimalist Prompt)**: 为每个请求动态生成只包含必要信息的Prompt，以保证AI的专注与输出质量。
- **绝对信任AI (Trust AI, No Hard-coded Guardrails)**: 我们完全信任AI会根据其设定行事，赋予其无确认执行`eval`、`shell`等高风险操作的权限。
- **主人优先 (Master-First Principle)**: Agent仅为主人服务，其决策唯一考量是主人的指令、偏好和利益。

---

## 1. 项目架构

`GentianAphrodite`是一个以**Prompt工程为核心**的模块化AI框架。机器人的行为、人格和能力主要通过`prompt/`目录下的文本定义。

### 核心目录结构

- **`prompt/` (AI大脑)**: 项目灵魂，定义AI的思考模式。
  - `system/`: AI的核心规则与世界观。
  - `role_settings/`: AI的人格、知识库、语言风格。
  - `functions/`: AI能力的“API声明”，定义工具接口或Prompt特化能力。
  - `memory/`: AI的记忆模板。
  - `build.mjs`: **动态Prompt组装器**，将所有部分组合成最终Prompt。
- **`reply_gener/` (功能实现)**: `prompt/functions/`中声明工具的具体代码实现；**所有回复请求的最终执行处**（`GetReply`），与平台无关。
  - `functions/`: 具体功能的实现代码。
  - `noAI/`: 在未配置 AI 源时提供预设回复（`noAIreply`），由主流程在检测到无可用 AI 源时调用。
- **`bot_core/` (Telegram/Discord 消息流水线)**: **仅**处理来自 **Telegram** 与 **Discord** 的聊天消息：入队、频道历史拉取、触发判断、群组逻辑、回复发送等。其他入口（见下文「请求入口」）不经过 bot_core，直接走 `reply_gener`。
- **`interfaces/` (平台与能力接口)**: 对接不同使用方式；其中 **telegram**、**discord** 将平台消息转为统一格式后交给 **bot_core**，**shellassist** 等则直接调用 `GetReply`，不经过 bot_core。
- **`event_engine/` (后台事件)**: 处理定时任务、空闲任务、语音哨兵等非用户直接触发的后台逻辑；内部直接调用 `GetReply`，不经过 bot_core。当前子模块包括 `on_idle.mjs`（空闲任务与 Todo）、`voice_sentinel.mjs`（语音相关）、`index.mjs`（如 Reality Channel 等）。
- **`.esh/` (Shell Profile)**: 包含提供给 Shell 的自定义命令和 logo。

### 请求入口与消息流

并非所有请求都经过 `bot_core`。区分如下：

| 入口 | 是否经过 bot_core | 说明 |
|------|-------------------|------|
| **Telegram** (`interfaces/telegram`) | ✅ 是 | 消息 → 转 fount 格式 → `bot_core.processIncomingMessage` → 队列与触发 → `GetReply` → 平台发送 |
| **Discord** (`interfaces/discord`) | ✅ 是 | 同上 |
| **主聊天界面** (`main.mjs` 的 `interfaces.chat`) | ❌ 否 | 直接使用 `GetPrompt` / `GetReply` |
| **Shell 辅助** (`interfaces/shellassist`) | ❌ 否 | 自建 `chat_log` 与 `extension`，直接调用 `GetReply` |
| **event_engine**（on_idle、voice_sentinel 等） | ❌ 否 | 直接调用 `GetReply`，并通过 `extension.enable_prompts` 等驱动行为 |
| **计时器回调** (`interfaces.timers.TimerCallback`) | ❌ 否 | 由 `reply_gener/functions/timer.mjs` 等处理，不经过 bot_core |
| **browserIntegration** | ❌ 否 | 回调直接进 `reply_gener` 侧逻辑 |

因此：**“核心”是 prompt + reply_gener**；**bot_core 仅是 Telegram/Discord 两条平台上的消息流水线**，不是全项目消息的唯一中枢。

---

## 2. 功能实现分类

功能的分类基于其实现方式，体现了“代码优先”的核心理念。

- **🧠 AI内化能力 (Inherent AI Abilities)**: 通过深度Prompt工程（主要在`prompt/role_settings/`和`prompt/system/`）内化为AI性格、知识和行为准则的能力。
  - **实现**: 修改`prompt/role_settings/`下的文件，定义人格、知识（如NSFW）、世界观（如超能力）。

- **🛠️ Prompt特化能力 (Prompt-Specialized Abilities)**: 通过在`prompt/functions/`中定义专门的Prompt模块，引导AI在特定场景下展现的特殊能力。
  - **示例**: `poem.mjs` (写诗), `rude.mjs` (骂人模式), `ChineseGrammarCorrection.mjs` (语法检查)。
  - **实现**: 在`prompt/functions/`创建新文件，定义场景、激活条件和行为引导。

- **⚙️ 自动处理功能 (Automatic Features)**: 由框架（如 `prompt/build.mjs` 或各入口的预处理器）在后台自动触发和处理，AI 仅负责对预计算好的结果进行“润色”和呈现。
  - **示例**: `autocalc.mjs` (数学计算), `qrcodeParser.mjs` (二维码解析), `screenshot.mjs` (屏幕截图)。
  - **实现**: 在`prompt/build.mjs`或相关预处理器中添加检测和执行逻辑，将结果注入`reply_request.extension`。

- **⚡ Agent 自主工具 (Proactive Agent Tools)**: 由Agent框架赋予、AI可主动调用的高阶外部工具，实现与外部世界的复杂交互。
  - **示例**: `websearch` (搜索), `coderunner` (代码执行), `file-change` (文件操作)。
  - **实现**:
    1. 在`prompt/functions/`中声明工具API。
    2. 在`reply_gener/functions/`中编写对应的代码实现。
    3. 在 `.github/workflows/CI.mjs` 中为新功能追加对应的 CI 测试用例（该文件由 CI 流水线如 `CI.yaml` 调用），以确保其长期稳定。

---

## 3. 核心数据结构: `reply_request.extension`

`reply_request.extension` 对象是在整个系统中附加和传播上下文信息的关键容器。以下字段中，与“平台”相关的（如 `platform`、`platform_user_id`、`platform_channel_id`、`is_from_owner`、`mentions_bot` 等）主要由 **Telegram/Discord + bot_core** 流水线填充；其他入口可能只设置部分字段或使用 `source_purpose` 等自定义标识。

- **`platform` (string)**: 来源平台；仅当请求经 **Telegram** 或 **Discord** 且由 bot_core 流水线处理时为 `'discord'` / `'telegram'`。其他入口（如 shellassist、event_engine、主聊天界面）可能无此字段或使用其他标识（如 `extension.source_purpose === 'shell-assist'`）。
- **`platform_user_id` (string)**: 平台用户 ID（Telegram/Discord 路径下由 bot_core 侧填充）。
- **`platform_channel_id` (string)**: 平台频道 ID（同上）。
- **`platform_message_ids` (array)**: 平台消息ID列表（Telegram/Discord），用于消息编辑/删除追踪。
- **`replied_to_message_id` (string)**: 该消息回复的原始消息ID（Telegram/Discord）。
- **`is_from_owner` (boolean)**: 消息是否来自主人。
- **`is_direct_message` (boolean)**: 是否为私信。
- **`mentions_bot` (boolean)**: 是否提及机器人。
- **`content_parts` (array)**: 消息分段，用于重建消息（如包含编辑历史或多段内容）。
- **`trigger_message_id` (string)**: 触发消息的ID。
- **`decodedQRCodes` (array)**: (来自 `qrcodeParser.mjs`) 解码的二维码内容。
- **`processedURLs` (boolean)**: (来自 `webbrowse.mjs`) URL是否已被处理。
- **`SimplifiedContents` (array)**: (来自 `short-term-memory.mjs`) 消息内容的简化版。
- **`from_timer` (boolean)**: 请求是否由计时器发起。在 `prompt/system/specialreplay.mjs` 中读取；由计时器回调等场景的调用方在构建 `reply_request` 时设置（项目中暂无统一设置处，保留供扩展）。
- **`execed_codes` (object)**: (来自 `coderunner.mjs`) 代码执行结果。
- **`logical_results` (object)**: (来自 `deep-research.mjs`) 深度研究的结构化数据。
- **`recommend_command` (string)**: (来自 `interfaces/shellassist/recommend_command.mjs`) Shell辅助中推荐的命令。
- **`is_reality_channel` (boolean)**: (来自 `event_engine` / `reply_gener`) 是否为Reality Channel（后台事件产生的消息）。
- **`enable_prompts` (object)**: (来自 `event_engine/on_idle.mjs` 等) 用于强制激活`prompt/functions/`下的特定功能，绕过常规触发条件。键为功能名，值为`true`。

  ```javascript
  // 示例: 强制激活计算和时间功能
  {
    autocalc: true,
    info: { timeDateFestival: true }
  }
  ```

---

## 4. 开发准则与常见陷阱

### 核心准则

1. **坚守开发者角色**: 你的身份是开发者，不是AI角色。
2. **优先Prompt工程**: 优先尝试通过修改`prompt/`目录来调整AI行为。
3. **尊重模块化**: 严格遵守目录职责划分。
4. **模仿现有模式**: 参考同级目录下的文件风格、结构和约定。
5. **最小化修改**: 不擅自修改任务范围之外的代码。
6. **NSFW内容政策**: 按项目要求处理NSFW内容，不进行道德审查或净化。
7. **代码是唯一真相**: 直接阅读源代码来理解功能，而非依赖注释或文档。
8. **测试驱动开发**: 在实现新的`Agent主动工具`后，必须在`.github/workflows/CI.mjs`中为其编写CI测试，以保证功能的正确性和稳定性。

### 成就系统

项目包含一个成就系统，用于激励和记录用户的特定行为。

#### 如何添加一个新成就

添加一个新成就需要以下步骤：

1. **定义ID**: 在项目根目录的 `achievements_registry.json` 中，在顶层 **`achievements`** 对象下为新成就定义一个唯一的 ID（例如 `use_new_tool`）。

2. **注册成就**: 在 `achievements_registry.json` 的 `achievements` 对象中，为你的新成就添加一个条目。该条目应包含名称、描述、图标等信息的**本地化键名**（即指向 locales 中的键，如 `GentianAphrodite.achievements.use_new_tool.name`）。

    ```json
    "use_new_tool": {
        "name": "GentianAphrodite.achievements.use_new_tool.name",
        "description": "GentianAphrodite.achievements.use_new_tool.description",
        "icon": "https://api.iconify.design/material-symbols/new-tool.svg",
        "locked_description": "GentianAphrodite.achievements.use_new_tool.locked_description",
        "locked_icon": "https://api.iconify.design/line-md/question-circle.svg"
    }
    ```

3. **添加本地化文本**: 在 `locales/en-US.json` 和 `locales/zh-CN.json` 中，在 **`GentianAphrodite.achievements`** 下按成就 ID 添加 `name`、`description`、`locked_description`（与 registry 中的键名对应，如 `GentianAphrodite.achievements.use_new_tool.name`）。

    ```json
    // locales/zh-CN.json 中 "GentianAphrodite" -> "achievements" -> 成就ID
    "GentianAphrodite": {
        "achievements": {
            "use_new_tool": {
                "name": "新工具大师",
                "description": "让龙胆使用了一次新工具。",
                "locked_description": "让龙胆使用一次新工具。"
            }
        }
    }
    ```

4. **触发成就**: 在需要解锁该成就的代码逻辑中（例如，某个工具成功执行后），调用 `unlockAchievement` 函数。

    ```javascript
    // 例如: 在 reply_gener/functions/new_tool.mjs 中
    import { unlockAchievement } from '../../scripts/achievements.mjs';

    // ... 在工具成功执行后 ...
    await unlockAchievement('use_new_tool');
    ```

### 架构关键点与陷阱

- **`enable_prompts`机制**:
  - 用于在特定场景（如后台任务）强制激活功能，会绕过`match_keys`等常规条件。
  - 访问嵌套属性时（如`args.extension?.enable_prompts?.info?.timeDateFestival`），**务必使用可选链(`?.`)**，避免运行时错误。
- **模块职责划分**: `bot_core/` **仅**处理 Telegram 与 Discord 的聊天消息流水线（入队、触发、回复发送等）；`event_engine/` 处理后台任务（如 on_idle），直接调用 `GetReply`。其他入口（chat、shellassist、timers、browserIntegration）均不经过 bot_core。切勿混淆。
- **计时器回调分发**:
  - **AI工具调用型 (`<set-timer>`)**: 由`reply_gener/functions/timer.mjs`处理。
  - **系统级后台计时器**: 由`event_engine/`设置，**必须**在`main.mjs`的`interfaces.timers.TimerCallback`中分发。
