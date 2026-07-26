# Fount 壳层对接对照

壳层契约以 fount `gentian_shell_contract` fixture 为准。对齐 GentianAphrodite 与 fount chat / bridge API 时查此表。

| 旧写法 | 新写法 |
|---|---|
| `interfaces.chat.onMessage` / `onGroupEvent` | **`OnMessage` / `OnGroupEvent`**（大小写必须与 `charAPI.ts` 一致，否则触发链静默不跑） |
| `src/scripts/i18n.mjs` | `src/scripts/i18n/bare.mjs`（`localhostLocales`） |
| `src/server/auth.mjs` | `src/server/auth/index.mjs` |
| `chat/lib/entity.mjs` → `agentEntityHash(...)` | `entity/member.mjs` → `ensureLocalAgentEntityHash(username, charname)` |
| `bridge/ops.mjs` → `requireBridgeOp` | `bridge/operations.mjs` → `requireBridgeOperation` |
| `chat/src/api/index.mjs` / `api/client.mjs` | `chat/src/api/client/index.mjs` → `getChatClient` |

身份：用 `ensureLocalAgentEntityHash`（钥派生）。**禁止**路径派生 `agentEntityHash(node, 'chars/X')`。
