# Agent Note：通过 workspace.moveSession 在工作区之间迁移会话

状态：已实现

[English](2026-08-18-session-move-workspace.md) | 中文

## 问题

会话永久绑定到创建时 `cwd` 匹配的工作区。用户重组项目目录后（例如把仓库移到独立目录），无法把已有对话带过去——会话留在旧工作区，显示错误的 Git 状态和文件树。

## 决策

新的一元 RPC `workspace.moveSession(workspaceId, sessionId)` 通过以下步骤迁移会话：将持久化 header 的 `cwd` 重写为目标工作区路径，然后从所有工作区摘除并挂到目标工作区。守护条件与 `deleteSession` 相同：存活会话报 `session-live`，子代理来源报 `session-subagent`，未知 id 报 `session-not-found`，未知目标工作区报 `workspace-not-found`。

持久层新增 `relocate(id, newCwd)` 契约，两个后端分别实现：SQLite 后端执行单条 `UPDATE sessions SET cwd = ?`；JSONL 后端读取完整日志、仅替换 header 行、通过与 `materialize` 相同的原子机制发布到新 cwd 推导路径，然后删除旧文件。在发布和清理之间崩溃会留下重复文件，`listArtifacts` 和 `findLog` 通过偏好 mtime 更新的文件来解决——迁移副本是最近写入的。

## 已考虑的替代方案

**仅覆盖工作区（不改 cwd）**被否决：会话的文件操作仍用旧目录，而 GUI 显示新工作区——正是 cwd-路径不变量所防止的混淆。

**fork 到新工作区**被否决：fork 产生新会话 id，破坏对原会话的引用，且重复存储事件日志。

**内存 sessionPath 覆盖**被否决：`indexHeader` 每次启动从持久化 header 重新推导映射，覆盖不会在重启后存活。

## 影响

任何具有 RPC 访问权的调用方都可以将已分离的顶层会话迁移到任何已注册的工作区。会话后续的文件操作、技能过滤和 fork 继承都使用新 cwd。日志中已有的事件保留原始内容（相对于旧 cwd 的路径），但不会被重新执行，因此仅用于继续向前工作时是安全的。JSONL 重复恢复路径（偏好更新的 mtime）弱化了对真正重复文件的完整性检查——真正的重复现在会静默解决而不是响亮地失败。

`pnpm run typecheck`、`pnpm run test:gui`（273 个文件、3,795 个测试）、apiproxy + session + workspace 套件（65 个文件、1,355 个测试）以及 `pnpm run doc-sync`（28 个校验门）全部通过。
