# Agent Note：通过 workspace.deleteSession 永久删除会话

状态：已实现

[English](2026-08-18-session-delete-rpc.md) | 中文

## 问题

GUI 此前只能归档会话而无法删除：持久化产物、工作区记账与归档集合条目无限累积。删除必须是永久的，同时不能危及存活或属于子代理的会话，且所有界面（列表、分组、归档集合）必须在一次操作中同时移除该 id。

## 决策

删除是一个一元 RPC `workspace.deleteSession`，由三类带类型的失败守护：携带存活 Agent 的会话报 `session-live`；子代理来源的会话（`SessionHeader.origin === 'subagent'`）报 `session-subagent`；不在持久层中的 id 报 `session-not-found`。成功时代理先执行 `sessionPersistence.destroy(id)`——新的后端契约，由 JSONL 与 SQLite 后端实现，物理移除一个会话的全部产物，对缺失产物幂等——随后执行 `workspaceRegistry.unaccountSession(id)`，把该 id 从所有工作区记账与注册表级归档集合中摘除。响应回显被删除的 `sessionId`。新的 RPC 错误码 `session-live` / `session-subagent` 已加入 `RpcErrorDetailsMap` 与错误 schema；设置面板改为通过 body 门户渲染（一个独立的客户端改动，同时补齐了该包的 `react-dom` devDependency 声明）。

## 已考虑的替代方案

**软删除标记**被否决：它把所有产物永久留在磁盘上，还迫使每个列表查询过滤；归档集合已经覆盖了可逆隐藏。

**由注册表负责物理删除**被否决：持久化后端各自持有其磁盘布局；注册表只负责摘除记账。

**强制分离后删除存活会话**在安全上被否决：进行中的 Agent 会继续向已不存在的产物追加写入，因此 RPC 拒绝，调用方须先分离。

## 影响

任何具有 RPC 访问权的调用方都可不可逆地删除已分离的顶层会话；存活与子代理所属的会话受到结构性保护。已持久化的空白会话与其他会话一样可删除。GUI 尚未暴露删除入口——在客户端界面选用之前，该 RPC 仅在 Host 侧可用。

`pnpm run typecheck`、`pnpm run test:gui`（273 个文件、3,786 个测试）、apiproxy 与 session 套件（62 个文件、1,304 个测试）以及 `pnpm run doc-sync`（28 个校验门）在接线完成后全部通过。
