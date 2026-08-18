# Agent Note：session.stop 释放已加载 agent，使会话可被迁移

状态：已实现

[English](2026-08-18-session-stop-rpc.md) | 中文

## 问题

`workspace.moveSession` 与 `workspace.deleteSession` 只要会话 store 里存在已加载条目，就用 `session-live` 拒绝该会话。这个判定有意落在 store 而非 agent 的 running 标志：agent 已加载但空闲的会话，也不得在生命周期中途被移动或销毁。但此前没有按需释放该 agent 的途径。浏览器在服务重启后重连并重新挂载其打开的会话，所以重启服务并不能让卡住的会话变得可迁移；`session.cancel` 只暂停当前回合，并且刻意保留 agent。

## 决策

新增一元 RPC `session.stop({ sessionId })`，通过 proxy 在创建/恢复该会话时保留的那份 `AgentHandle` 把已加载 agent 彻底拆掉。`handle.dispose()` 会停止循环并等待其退出、注销 agent、把会话从 store 移除、并拆解其作用域世界——于是随后的 `workspace.moveSession` 不再把该会话视为 live。注册表（`ctx.agents`）不暴露任何公开 dispose 路径，而 handle 是只有持有者能用的能力，因此 `createApiProxy` 现在维护 `Map<SessionId, AgentHandle>`，在每次其发出的 `ctx.agents.create`/`resume`（`ensureSession`）时填充。

guard 与同类破坏性操作对齐：

- 无 live agent → `session-not-found`（会话本就可迁移）。
- 子代理会话 → `session-subagent`（其拆解归属委派它的父 agent）。
- 非本 proxy 创建的 live agent（loop 自有 config agent）→ `internal`（"does not own"）。

`session.stop` 也会中止正在运行的回合；调用方不得对正在驱动自己的对话调用它。

## 备选方案

**给 AgentRegistry 暴露 dispose 路径**被否：注册表刻意不保留 dispose 闭包——handle 就是完整的拆解能力，在注册表层加拆解会让任何持有 `ctx` 的人都能停掉并不归其所有的 agent。

**用带更强标志的 `session.cancel` 复用**被否：cancel 保留 inbox 并维持 agent 以便 FIFO 恢复；释放 agent 是结构上不同的生命周期动作，应单列方法。

**重启服务兜底**（本改动前的迁移 skill 文档）被否：浏览器在重连时会重新挂载打开的会话，重启并不能释放它们。

## 影响

任何有 RPC 访问权的人都能停止其可达的普通会话；正在运行的回合会被中止且没有干净的 turn/end。被停止的会话完整持久化，之后可正常恢复。proxy 现在为每个已创建/恢复的会话保留一个 handle（以 live 会话数为上界；handle 仅在隐式丢弃——后续可在 `agent/disposed` 时清理作为改进）。

`pnpm run typecheck`、apiproxy 测试套件（379 个，含 4 个新增 `sessions.stop` 用例）、`pnpm run doc-sync` 全部通过。
