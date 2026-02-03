# GentianAphrodite × subfounts 多机执行分析与实现计划

## 一、分析结论：需要且可通过 subfounts 实现多机执行的功能

| 功能              | 当前实现位置                            | 设备绑定性                                         | 多机需求                                   | subfounts 能力                                                          | 可行性  |
| ----------------- | --------------------------------------- | -------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------- | ------- |
| **摄像头 prompt** | `prompt/functions/camera.mjs`           | 依赖本机 node-webcam                               | 用户可能在分机前（如笔记本），主机无摄像头 | `executeCodeOnSubfount` 在分机执行拍照代码并返回 Buffer                 | ✅ 可行 |
| **截图 prompt**   | `prompt/functions/screenshot.mjs`       | 依赖本机 captureScreen                             | 同上，需看“用户当前所在设备”的屏幕         | 同上，在分机执行截屏代码并返回 Buffer                                   | ✅ 可行 |
| **代码执行**      | `reply_gener/functions/coderunner.mjs`  | run-js / run-pwsh 等在本机执行                     | 需在指定设备跑代码（如“在客厅电脑放歌”）   | `executeCodeOnSubfount` / `executeShellOnSubfount` 已支持按分机 ID 执行 | ✅ 可行 |
| **文件操作**      | `reply_gener/functions/file-change.mjs` | view-file / replace-file / override-file 在本机 fs | 需查看/修改分机上的文件                    | 在分机执行读/写文件的代码或 shell，结果回传主机                         | ✅ 可行 |
| **主机信息**      | `prompt/functions/hostinfo.mjs`         | os/exec 等本机信息                                 | 需展示各分机的设备信息                     | subfounts 已有 `device_info`，`getConnectedSubfounts` 含 `deviceInfo`   | ✅ 可行 |

**说明**：

- subfounts 已提供：`executeCodeOnSubfount(username, subfountId, script, callbackInfo)`、`executeShellOnSubfount(username, subfountId, command, shell, options)`、`getConnectedSubfounts(username)`，以及角色侧 `interfaces.subfount.RemoteCallBack` 回调。
- 上述功能均可在“有 subfounts 且用户已连接分机”的前提下，通过“在指定分机上执行代码/命令并把结果回传”的方式实现多机执行。

**设计补充**：

- **当前工作主机（默认执行分机）**：在各工具支持 `subfount` 参数的同时，为角色增加一个**新工具**，用于切换“当前工作主机”（设置默认执行分机 ID）。这样 AI 不必在每次调用时都写 `subfount="1"`，而是先通过该工具设定默认设备，后续未带 `subfount` 的调用均在该设备上执行，逻辑更清晰、调用更友好。
- **分机侧 JS workspace**：本机 coderunner 有 `workspace`（多轮对话间持久化变量）。当前 subfount 的 `executeCode` 每次仅执行脚本，无持久化上下文。建议**在 subfount 侧**按 `partpath` 维护一个 `Record`：为每个部件在每个分机上开辟一块**不会被清空的工具区**（即 per-partpath、per-subfount 的 workspace），远程执行时将该 workspace 注入 eval 上下文，使多轮 `<run-js>` 在同一分机上也能使用 `workspace.xxx` 等能力。

---

## 二、不纳入或后续再考虑的功能

- **webbrowse / browserIntegration**：若涉及在特定设备上打开页面或控制浏览器，理论上也可走“在分机执行代码”，但依赖与现有 browser 集成的设计，建议在代码执行多机化稳定后再扩展。
- **剪贴板 / 窗口列表**（hostinfo 中的部分）：多机化时需在分机执行相应代码并汇总，可与“主机信息多机”一起做。

---

## 三、实现计划

### 阶段 0：依赖与前置条件

- 角色在 reply 中能拿到 `args.username`（已满足）。
- 角色需能安全获取 subfounts 能力：
  - **方案 A**：在 reply 层动态 import subfounts 的 api（如 `src/public/parts/shells/subfounts/src/api.mjs`），仅当 shell 为 subfounts 或配置开启时才调用。
  - **方案 B**：由 chat/服务器在请求上下文中注入“当前用户是否启用 subfounts、执行接口”的抽象，角色只依赖该抽象（需与 fount 主仓协商接口）。
- 建议先采用方案 A 实现最小可用，再视需要抽象为方案 B。

### 阶段 0.5：当前工作主机 + subfount 侧 workspace（与阶段 1 协同）

- **当前工作主机（默认执行分机）**
  - **目标**：角色拥有一个**新工具**，用于设置“当前工作主机”（默认执行分机 ID）。此后，所有支持分机参数的工具在**未显式写 `subfount` 时**，均在该默认分机上执行，从而减少重复写 `subfount="1"`、逻辑更自然。
  - **存储**：默认分机 ID 需与会话/用户绑定且可跨轮次保持。可选方案：
    - 存于该用户该角色下的 chat-scoped 或 session 存储（如 `args.chat_scoped_char_memory.default_subfount_id` 或 extension 提供的字段）；
    - 或存于 shell 侧该用户的设置（如 subfounts 的 `loadShellData(username, 'subfounts', 'default_subfount_id')`），由角色在 prompt 中读取、在 reply 中写入。
  - **工具形态**：在 prompt 中约定一种调用方式，例如 `<set-work-subfount>id</set-work-subfount>` 或 `<current-work-subfount>id</current-work-subfount>`，表示“将当前工作主机设为分机 id”；id 为 0 表示主机。Reply 层解析该标签并写入上述存储，并在后续轮次的 prompt 中告知 AI“当前工作主机为分机 X”。
  - **各工具语义**：run-js、file-change、摄像头/截图等多机工具在解析时：若标签上**有** `subfount` 属性则用其值；若**没有**则使用“当前工作主机”。若当前工作主机未设置，则回退为 0（主机）或“仅本机执行”的现有语义。

- **subfount 侧按 partpath 的 workspace**
  - **目标**：JS 执行需要 `workspace`（多轮间不清空）。当前 subfount 的 `executeCode` 只传 `script` 和 `callbackInfo`，每次执行是独立 eval，无持久化。
  - **方案**：**修改 subfount**（`api.mjs` 及分机端执行逻辑）：
    - 在主机侧维护一个 **Record**：按 `(username, partpath, subfountId)` 或等价的 key 为每个“部件在该用户该分机上的调用”开辟一块 **workspace 对象**，且**不随单次调用结束而清空**（仅随用户/分机/部件卸载等策略回收）。
    - `executeCodeOnSubfount(username, subfountId, script, callbackInfo, hostPeerId)` 增加可选参数 `partpath`；若传入，则主机在发送给分机的 payload 中带上 `partpath`。
    - **分机端**（如 `subfount.mjs` 的 run_code 处理）：在本地同样维护按 `partpath`（或 username+partpath）的 workspace Record；执行 `async_eval(script, { callback, workspace })` 时，从该 Record 中取出或创建对应 partpath 的 workspace 对象，注入 eval 上下文，执行完毕后将可能被修改的 workspace 保留在 Record 中（若需跨机一致可考虑在 response 中把 workspace 序列化回传主机并由主机下次下发，实现细节可后续定）。
  - **结果**：角色在分机上执行 `<run-js>` 时，可像本机一样使用 `workspace.xxx`、`workspace.clear()` 等，实现多轮执行间的状态保持。

### 阶段 1：代码执行多机化（优先级最高）

- **目标**：AI 可指定在某一台分机上执行 `<run-js>` / `<run-pwsh>` 等，而不是仅在本机；未指定时使用「当前工作主机」（见阶段 0.5）。
- **Prompt**（`prompt/functions/coderunner.mjs`）：
  - 当存在已连接分机时，在 CodeRunner 的说明中增加：
    - 当前已连接分机列表（id、deviceId、description 等简要信息）。
    - **当前工作主机**：若已通过 `<set-work-subfount>` 设置，则明确写出“当前工作主机为分机 X”；未设置则说明默认为 0（主机）。
    - 语法约定：如 `<run-js subfount="1">code</run-js>`、`<run-pwsh subfount="0">code</run-pwsh>`（0 表示主机）；**不写 `subfount` 时在“当前工作主机”上执行**。
  - 可选：说明可通过 `<set-work-subfount>id</set-work-subfount>` 切换当前工作主机。
- **Reply**（`reply_gener/functions/coderunner.mjs`）：
  - 先处理 `<set-work-subfount>id</set-work-subfount>`，将 id 写入当前工作主机的存储。
  - 解析 `<run-js>` / `<run-pwsh>` 等标签上的 `subfount` 属性；若未写则使用当前工作主机（默认 0）。
  - 若目标为远程分机（subfountId !== 0）：
    - 调用 `executeCodeOnSubfount(args.username, subfountId, script, callbackInfo, null, partpath)`（或 subfount 扩展后的接口），传入 **partpath** 以便 subfount 按 partpath 注入该分机上的 workspace；callbackInfo 含 partpath 以支持 RemoteCallBack。
  - 若目标为本机（0 或未设）：保持现有本地执行逻辑（含现有 workspace）。
- **测试**：本机 + 至少一台分机；验证指定 subfount、不指定 subfount（用当前工作主机）、切换当前工作主机后执行；验证分机上多轮 `<run-js>` 的 workspace 持久化；callback 触发 RemoteCallBack。

### 阶段 2：摄像头 / 截图 prompt 多机化

- **目标**：当用户说“看看我/看看屏幕”时，可优先使用“用户所在设备”或指定分机的摄像头/截屏；**未指定分机时使用「当前工作主机」**（与代码执行等工具一致）。
- **策略**：
  - 取像分机 id 的优先级：显式参数（若将来扩展）> 当前工作主机 > 0（仅主机）。
  - **摄像头**：通过 `executeCodeOnSubfount(username, subfountId, captureWebcamScript)` 在分机执行拍照逻辑，返回 Buffer；主机将 Buffer 填入 `additional_chat_log`。
  - **截图**：同理，在分机执行截屏代码，返回 Buffer，主机写入 prompt。
- **实现要点**：
  - 在 `prompt/functions/camera.mjs` 与 `screenshot.mjs` 中：当存在已连接分机时，取“当前工作主机”或 extension 传入的取像分机 id；若为远程分机则调用 subfounts 执行远程代码并等待 Buffer，否则沿用现有本机 `captureWebcam()` / `captureScreen()`。
- **测试**：分机有摄像头/屏幕时，设置当前工作主机为该分机，验证 prompt 中收到的是分机图像。

### 阶段 3：文件操作多机化

- **目标**：AI 可对指定分机上的路径执行 `<view-file>` / `<replace-file>` / `<override-file>`；**未写 `subfount` 时使用「当前工作主机」**。
- **语法扩展**：例如 `<view-file subfount="1">path1\npath2</view-file>`；缺省则使用当前工作主机，`subfount="0"` 表示主机。
- **Reply**（`reply_gener/functions/file-change.mjs`）：
  - 解析 view/replace/override 上的 `subfount` 属性；未写则取当前工作主机。
  - 若为远程分机：在分机执行读/写文件的脚本，结果回传并汇总到现有 tool 日志；路径在分机上解析为分机本地路径。
- **安全**：分机执行文件操作时需沿用当前角色的权限与路径约束，避免跨用户越权。

### 阶段 4：主机信息多机化

- **目标**：Prompt 中不仅展示主机信息，还展示各已连接分机的设备信息；并标明**当前工作主机**是哪一个，便于 AI 选择设备或理解默认执行目标。
- **实现**：
  - 在 `prompt/functions/hostinfo.mjs` 中：若存在 `getConnectedSubfounts(args.username)` 且返回非空，则对每个分机使用其 `deviceInfo`；并写入“当前工作主机为分机 X（id/description）”。
  - 主机本机信息保持现有 os/exec 逻辑不变。
- **展示格式**：如“当前工作主机：分机 1；主机：…；分机 1：…；分机 2：…”，便于 AI 区分设备与默认目标。

### 阶段 5：文档与配置

- 在角色或 fount 的 AGENTS.md 中简述：
  - 哪些能力支持“多机执行”；
  - **当前工作主机**：`<set-work-subfount>id</set-work-subfount>` 的用法，以及未写 `subfount` 时各工具使用当前工作主机的语义；
  - 分机侧 **workspace**：按 partpath 持久化、多轮 `<run-js>` 可用 `workspace.xxx`；
  - 依赖 subfounts shell 与分机连接状态。
- 如有“默认取像/执行设备”等配置，与“当前工作主机”统一说明。

---

## 四、实现顺序建议

1. **阶段 0**：确认 subfounts api 的 import 路径与调用方式（含错误处理：subfounts 未加载、用户无分机等）。
2. **阶段 0.5**：
   - **subfount 侧**：在 api.mjs 及分机端（subfount.mjs）实现按 partpath 的 workspace Record，并在 `executeCode` 时注入 eval 上下文；`executeCodeOnSubfount` 增加 partpath 参数并下发给分机。
   - **角色侧**：实现「当前工作主机」的存储与工具 `<set-work-subfount>id</set-work-subfount>`（解析并写入 chat_scoped 或 shell 设置）；在 prompt 中暴露“当前工作主机”与分机列表。
3. **阶段 1**：代码执行多机化（未写 subfount 时用当前工作主机；传 partpath 以使用分机 workspace）。
4. **阶段 4**：主机信息多机化（含当前工作主机标注）。
5. **阶段 2**：摄像头/截图多机化（取像分机默认用当前工作主机）。
6. **阶段 3**：文件操作多机化（未写 subfount 时用当前工作主机）。
7. **阶段 5**：文档与配置收尾。

---

## 五、风险与注意点

- **依赖方向**：角色依赖 shell（subfounts）的 api，需避免循环依赖；import 失败时应降级为“仅本机”行为。
- **当前工作主机**：存储位置（chat-scoped vs shell 设置）需与“多会话/多前端”语义一致；未设置时各工具回退为 0（主机）或仅本机，避免误在错误设备执行。
- **分机 workspace**：按 partpath（及 username、subfountId）隔离，避免不同部件或不同用户互相污染；需约定回收策略（如用户登出、分机断开时清理对应 Record）。若分机端维护 workspace、主机不持久化，则主机侧无需存 workspace，仅传 partpath；若需跨轮次一致，可考虑分机在 response 中返回序列化 workspace 由主机下次下发（注意序列化体积与安全）。
- **回调**：分机执行长时间任务时使用 `callbackInfo` + `RemoteCallBack`，需保证 partpath 正确，且角色实现 `interfaces.subfount.RemoteCallBack`。
- **序列化**：跨机传递 Buffer/大对象时注意 subfounts 现有序列化方式（如 v8 serialize），避免超长或不可序列化结构。
- **隐私与权限**：多机执行时明确“仅对当前用户已连接的分机”执行，且不跨用户；文件与摄像头涉及隐私，需在 prompt 中保留现有“主人/非主人”的提醒逻辑。
