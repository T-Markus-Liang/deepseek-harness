---
name: dsh-migrate-workspace-sessions
description: 跨项目/工作区会话迁移 —— 把对话（session）从一个工作区迁移到另一个工作区。当用户要重组项目目录、把旧仓库的会话搬到新工作区、或问“把对话迁移到另一个项目/工作区/目录”时使用。Uses workspace.moveSession to relocate conversations between workspaces (cross-project migration).
---

# DSH 跨工作区会话迁移（Cross-Workspace Session Migration）

把持久化会话从源工作区迁到目标工作区。迁移会**重写会话 header 的 `cwd`** 为目标工作区路径，并把 JSONL 日志物理移动到新 cwd 推导出的路径（SQLite 后端则更新 `cwd` 列）。迁移后会话的后续文件操作、技能过滤、fork 继承全部基于新 cwd。

> 中文说明 | English section below

## 什么时候用

- 用户把仓库/项目移到新目录后，要把旧目录里的对话一起带过去
- 用户想清理工作区：把散落在多个工作区的会话归拢到一个
- 用户在多个项目目录间搬运开发工作

**核心 RPC：`workspace.moveSession({ workspaceId, sessionId })` → `{ sessionId, workspaceId }`**

## 前置条件

1. 运行中的 dsh-web 服务已包含 `workspace.moveSession`（feature commit `baccf278` 起）。验证：
   ```sh
   curl -s -X POST http://127.0.0.1:3080/api/workspace.list -H 'content-type: application/json' \
     -d '{"type":"client-request","rpcId":"w1","method":"workspace.list","payload":{}}'
   ```
   若返回 `unknown method`，需先重建 host bundle（`npx tsdown --env.DSH_BUILD_FACE host`）并重启服务。

2. 目标工作区已存在（`workspace.list` 中可见）。

## 执行步骤

### 1. 盘点：工作区与会话

```sh
curl -s -X POST http://127.0.0.1:3080/api/workspace.list -H 'content-type: application/json' \
  -d '{"type":"client-request","rpcId":"w","method":"workspace.list","payload":{}}' \
  | python3 -m json.tool
curl -s -X POST http://127.0.0.1:3080/api/session.list -H 'content-type: application/json' \
  -d '{"type":"client-request","rpcId":"s","method":"session.list","payload":{}}' \
  | python3 -m json.tool
```

- `workspace.list` 的每一项含 `workspaceId`、`path`、`sessionIds`
- `session.list` 的每一项含 `sessionId`、`cwd`、`running`（`true` = 正在运行回合）

### 2. 判断会话是否可迁移（关键约束）

**live 会话不能迁移。** 会话只要有加载中的 agent（无论 `running` 与否），`moveSession` 就返回 `session-live`。判定：

| 信号 | 含义 |
|---|---|
| `running: true` | 正在跑回合 → 不可迁移 |
| `running: false` 但 moveSession 仍报 `session-live` | agent 已加载但空闲 → 不可迁移 |
| 不在 `session.list` | 已持久化、未加载 → 可迁移（最干净） |

**释放 live 会话的唯一方式（无 `session.stop` RPC）：**

- **结束对话**：会话停止后 agent 被释放。当前正在运行的对话（正在执行迁移的会话自己）无法在运行期间迁移，需等其结束。
- **重启服务**：`com.deepseek.dsh-web` 的 launchd plist 有 `KeepAlive: true`，杀掉会自动重启。重启后**所有**会话变为非 live，全部可迁移。这是批量迁移剩余会话的最快路径。重启会中断当前对话的回合（会话持久化，可恢复）。

### 3. 逐一迁移

```sh
curl -s -X POST http://127.0.0.1:3080/api/workspace.moveSession -H 'content-type: application/json' \
  -d '{"type":"client-request","rpcId":"m","method":"workspace.moveSession","payload":{"workspaceId":"<TARGET>","sessionId":"<SESSION>"}}'
```

**必须逐一调用**（每个会话一次），不要并发：`relocate` 按会话串行化，且并发同 id 会触发 in-memory state 守卫。

### 4. 核对完整性

迁移后必须核对四处：

1. **工作区归属**：`workspace.list` —— 源工作区 `sessionIds` 减少，目标工作区增加对应会话。
2. **持久化 cwd**：`session.list` —— 会话的 `cwd` 已变为目标工作区路径。
3. **JSONL 物理文件**（JSONL 后端）：`root/projectKey(newCwd)/<segment>/session.jsonl` 存在、旧路径下文件已删除、空目录已清理。
   ```sh
   # 以 ~/.dsh 数据根为例
   ls -la "/Users/markus/.dsh/root/..."   # 按实际数据根定位
   ```
4. **header 可重建路径**：`assertStoredIdentity` 校验 header cwd 能重建物理路径；若报 `corrupt session log`，说明迁移中断。

### 5. 崩溃恢复语义

`relocate` 在 JSONL 后端 = 写新文件 → 删旧文件。若在两步之间崩溃，同一 id 会有两个文件。`listArtifacts` / `findLog` 的重复处理是**偏好 mtime 更新的文件**（迁移副本刚写入，mtime 最新），静默恢复而不是报错。核对时若发现重复，确认新路径文件存在且 header 正确即可。

## 错误码

| code | 触发条件 | 处理 |
|---|---|---|
| `session-live` | 会话有加载中的 agent | 结束对话或重启服务后再试 |
| `session-subagent` | 会话 origin 是子代理 | 不可迁移，跳过 |
| `session-not-found` | id 不存在或 header 缺失 | 核对 id |
| `workspace-not-found` | 目标工作区不存在 | 先创建/核对 workspaceId |
| `internal` | 后端 relocate 失败 | 查 /tmp/dsh-web.log |

## 边界与限制

- **只迁移顶层会话**。子代理会话（`origin: subagent`）报 `session-subagent`。
- **会话的 cwd 会永久改写**。旧日志里的事件保留原始路径（相对旧 cwd），但**不会重放**，仅用于向前续写，所以无害。
- 迁移后在新工作区**恢复**该会话（GUI 或 resume）会走到 `SessionCwdConflict` 校验——GUI 从 `session.list` 读到新 cwd，不会冲突。
- 当前正在运行的对话无法迁移自己；它结束（或服务重启）后才能迁移。

---

## English

### When to use

The user reorganizes their projects (moving a repo to a dedicated directory) and wants existing conversations brought along; or wants to consolidate sessions scattered across workspaces; or asks to move conversations to another project/workspace/directory.

### Core RPC

`workspace.moveSession({ workspaceId, sessionId })` → `{ sessionId, workspaceId }`. It rewrites the persisted header `cwd` to the target workspace's path and relocates the JSONL artifact (SQLite: single `UPDATE sessions SET cwd = ?`).

### Live-session constraint

A session with a loaded agent (running or idle) fails with `session-live` by design. There is no `session.stop` RPC yet. To release sessions: end the conversation, or restart the service (`launchctl kickstart -k gui/$(id -u)/com.deepseek.dsh-web`; plist `KeepAlive: true` auto-restarts). After a restart every session is non-live and migratable. The currently running conversation cannot migrate itself mid-turn.

### Workflow

1. Enumerate: `workspace.list` + `session.list`.
2. Classify liveness (`running` flag; a `session-live` rejection means a loaded agent).
3. Call `workspace.moveSession` once per session (never concurrent).
4. Verify: workspace membership, persisted `cwd`, JSONL artifact moved (old path removed), header reconstructs the path.
5. Crash recovery: a duplicate from a crash between publish and cleanup resolves to the newer mtime file.

### Error codes

`session-live` / `session-subagent` / `session-not-found` / `workspace-not-found` / `internal`. See table above.

### Related

- Agent Note: `.agents/notes/implemented/feature/2026-08-18-session-move-workspace.md`
- Persistence backend: `packages/session/session-persistence-jsonl` (`relocate`, duplicate recovery in `listArtifacts`/`findLog`)
