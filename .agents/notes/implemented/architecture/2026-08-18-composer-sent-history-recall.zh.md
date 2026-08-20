# Agent Note：Composer 已发送消息历史回溯（终端风格 ↑/↓）

[English](2026-08-18-composer-sent-history-recall.md) | 中文

Status: implemented

## 问题

用户期望通过 ↑/↓ 方向键在输入框中回溯已发送的消息，终端风格：在空白草稿中按 ↑ 填入最近发送的消息，继续按 ↑ 遍历更早的消息，按 ↓ 向前返回。若不支持此功能，重新发送类似消息需要重新输入或从对话记录中复制。

直接在所有情况下响应 ↑/↓ 会破坏现有输入契约：方向键也是多行光标导航，输入经过 IME 必须保持原样，且机器的撤销日志不应将历史浏览视为编辑事务（撤销会意外恢复已浏览的草稿）。

## 决策

在 InputMachine 中为已发送消息添加一个有限的历史栈，仅在首行/末行位置通过 ↑/↓ 浏览。

### 状态

四个新的 `InputState` 成员：

- `history: readonly string[]` — 已发送消息的纯文本投影，最新在末尾，上限 `HISTORY_LIMIT`（50）。连续重复去重，空白/纯空格发送不记录。
- `historyIndex: number` — 浏览游标：`-1` 为普通草稿模式，否则为 `history` 中的索引。
- `historyDraft: string` — 浏览开始时保存的草稿，超过最新条目后恢复。
- `historyDraftOccurrences`（机器内部，不发布）— 与 `historyDraft` 一起保存的引用块表。

### 事件与机器行为

两个新事件 `history-prev`（↑）和 `history-next`（↓），仅在 `plain` 阶段响应：

- `history-prev` 在 `historyIndex === -1` 时进入浏览：保存草稿和引用块，清空活跃引用块，采用最新条目。继续 ↑ 步进更早条目，到达最旧条目时停止。
- `history-next` 在 `historyIndex === -1` 时为空操作。否则步进更新条目，超过最新条目后恢复 `historyDraft` 及其引用块，返回 `historyIndex === -1`。
- `send-committed` 在清除草稿前将 `projectClipboard(state)` 记录到 `history`，与普通发送提交相同：不推送撤销单元，撤销日志被截断，已发送内容不可恢复。空白和重复发送跳过推送，栈按 `HISTORY_LIMIT` 裁剪最旧条目。
- 浏览中用户 `draft-changed` 将游标重置为 `-1`（保存的 `historyDraft` 保留，仅游标重置），从回显条目输入如同正常编辑。

### 键盘仲裁（InputBar）

keydown 处理器保持先 `keyboard.arbitrate('up'|'down', composing)`：打开菜单时方向键用于菜单导航。仅 `'pass'` 结果且无 IME 组合状态时进入历史回溯，且仅当光标在草稿的第一行（↑）或最后一行（↓）时——`draft.slice(0, caret)` / `draft.slice(caret)` 中不含换行符。这保护了多行光标移动：中间光标仍按行移动，仅无法继续移动的方向触发回溯。成功回溯时处理器 `preventDefault` 并将光标停在回忆草稿末尾。

## 实现说明

- **记录使用剪贴板投影**：`onSendCommitted` 调用 `projectClipboard`，U+FFFC 占位符被替换为普通文本，引用块永不泄漏到历史中。
- **导航不通过 `pushTxn`**：↑/↓ 直接调用 `adopt()`，不创建撤销单元，撤销日志不受影响。
- **引用块冻结与不可变数组兼容**：进入浏览时快照 `occurrences` 到 `historyDraftOccurrences` 并清空活跃表，恢复时重新赋值。
- **阶段保护**：仅 `plain` 响应，↑/↓ 永不中断 `adjudicating` / `claimed` / `submitting`。
- **IME**：`composing`（包括旧版 `keyCode === 229` 信号）排除整个方向键回溯分支。

## 测试

机器行为由纯 JS 事件序列测试覆盖（`input-machine.client.spec.ts`）：空历史空操作；发送记录包括引用块投影、连续重复去重、空白跳过；↑ 进入浏览并保存草稿；重复 ↑ 停在最旧条目；↓ 向前步进；↓ 超过最新条目恢复草稿及引用块；浏览中编辑重置游标；`HISTORY_LIMIT` 淘汰；阶段守卫（`claimed` / `adjudicating` / `submitting` 拒绝两个事件）。

## 备选方案

- **无条件响应 ↑/↓**：被拒绝——方向键是原生多行光标移动，无条件回溯使长草稿中无法按行移动光标。首行/末行守卫保留光标语义。
- **在撤销日志中记录历史浏览**：被拒绝——浏览不是编辑，撤销单元会使 Ctrl/Cmd-Z 恢复已浏览草稿。
- **更大或无限的历史栈**：被拒绝——`HISTORY_LIMIT`（50）限制内存并匹配回溯使用场景。
- **任意阶段响应回溯**：被拒绝——仅 `plain` 阶段，避免未决命令声明、裁决或执行中的提交被导航中断。

## 后果

- 终端风格回溯无需新 UI：↑/↓ 键已通过 `ComposerKeyboard` 到达机器，首行/末行守卫保留多行光标移动。
- 回溯草稿为纯文本（记录了剪贴板投影），始终可发送。
- 浏览永不触碰撤销日志，撤销保持纯编辑历史。
- 每会话内存上限为 `HISTORY_LIMIT` 条纯文本，额外状态极小。
- 方向键回溯仅从 `'pass'` 仲裁触发，打开的菜单保持方向键控制权。