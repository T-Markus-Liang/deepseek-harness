# Agent Note：rc.8 会话生命周期操作

[English](2026-08-20-session-lifecycle-rc8.md) | 中文

状态：已实现

## 问题

0.8.0 之前的本地会话控制曾通过独立的 `SessionPersistenceAdmin` 服务临时恢复，并暴露 `destroy` 与 `relocate`。这会绕过 rc.8 写入协调器的状态管理和按 id 串行化。

## 决策

rc.8 的 `SessionPersistence` 服务继续作为上游读写接口。分离会话操作通过可选的 `SessionLifecycle` 服务（`ctx.sessionLifecycle`）提供。第一方 provider 注册该服务，并将操作委托给同一个 `PersistenceCoordinator`；协调器负责检查活动和退出中的会话、串行化每个操作与待处理写入，并在删除后使分离状态失效。后端 hook 仍使用 `removeArtifact` 与 `moveArtifact`，因此存储层的字节或行变更留在协调器之后，不暴露旧的兼容性词汇，也不扩大 rc.8 服务。

JSONL 将持久化文件移动到目标位置并原子重写目标 header；SQLite 在一个事务中更新会话行。两个 provider 对不存在的 id 都执行幂等空操作。Host 删除或迁移前先释放 proxy 所拥有的活动 agent，再调用持久化服务；workspace 在持久化操作成功后更新 accounting 和归档成员关系。

## 结果

第三方 rc.8 persistence 实现可以不提供 `SessionLifecycle`。在没有该服务时，Host 和 Workspace 会在请求生命周期 RPC 时明确报错。代码中不再保留 `SessionPersistenceAdmin`、`destroy` 或 `relocate` API。聚焦的后端、workspace、stop 和 carrier 测试覆盖恢复的行为及其 wire contract。

## 已考虑的替代方案

- 将 `remove` 和 `move` 放在 `SessionPersistence` 上：拒绝，因为这会扩大上游 rc.8 服务，使每次未来 persistence 接口升级都携带本地生命周期改动。
- 恢复独立的 `SessionPersistenceAdmin`：拒绝，因为它暴露旧的所有权词汇，并将协调器的按 id 串行化与持久化写入所有者拆开。
