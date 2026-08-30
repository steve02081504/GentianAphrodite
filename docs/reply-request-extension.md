# `reply_request.extension` 字段参考

`reply_request.extension` 在全链路传递上下文。主人判定与消息正文约定见 [AGENTS.md](../AGENTS.md)；本文列字段全集。

## 聊天 / 身份（壳层）

- **`extension.chat.bridge`**：逐条桥接身份（`platform`、`platformUserId`、`authorEntityHash`、`replyToEventId` 等）；亦水合进 `chat_log` 条目的 `extension.chat.bridge`。
- **`extension.chat.attribution` / `extension.chat.eventId` / `extension.chat.replyTo`**：壳层水合与 `getChatRequest` 注入。
- **`extension.declaredOwnerEntityHash`**：顶层声明主人。`MasterRecognizePrompt` 对归因 mismatch 发最高优先级防伪警告。
- **消息正文**：`OnMessage` / `chat_log` / ChatClient `Message.content` 恒为 fount `chatLogEntry_t` 的 **string**；直接读 `content`，不拆包。

`OnMessage` 内主人判定：声明主人（`identity.ownerEntityHash`，默认 operator）+ 可信归因（无 `importedFrom` / attribution mismatch）。**不要**把 care 列表或裸 operator 哈希当主人。

## 常用标志

| 键 | 类型 | 用途 |
|---|---|---|
| `is_direct_message` | boolean | 是否私信 |
| `mentions_bot` | boolean | 是否提及机器人 |
| `content_parts` | array | 分段内容（编辑历史 / 多段重建） |
| `trigger_message_id` | string | 触发消息 ID |
| `is_reality_channel` | boolean | Reality Channel 后台流量（`event_engine` / `reply_gener`） |
| `from_timer` | boolean | 计时器发起的请求；`prompt/system/specialreplay.mjs` 读取 |
| `enable_prompts` | object | 强制激活 `prompt/functions/` 模块，绕过常规 `match_keys` |

```javascript
// 强制激活计算与时间/节日
{
  autocalc: true,
  info: { timeDateFestival: true }
}
```

读嵌套 `enable_prompts`（如 `args.extension?.enable_prompts?.info?.timeDateFestival`）务必可选链。

## 功能注入字段

| 键 | 类型 | 来源 |
|---|---|---|
| `decodedQRCodes` | array | `qrcodeParser.mjs` |
| `processedURLs` | boolean | `webbrowse.mjs` |
| `SimplifiedContents` | array | `short-term-memory.mjs` |
| `execed_codes` | object | `coderunner.mjs` |
| `logical_results` | object | `deep-research.mjs` |
| `recommend_command` | string | `interfaces/shellassist/recommend_command.mjs` |
