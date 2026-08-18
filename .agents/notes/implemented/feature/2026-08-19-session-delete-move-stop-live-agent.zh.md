# Agent Note：deleteSession / moveSession 通过 proxy 保留的 handle 先 dispose live agent

Status: implemented

English | [中文](2026-08-19-session-delete-move-stop-live-agent.zh.md)

## 问题

GUI 里删除对话时报 `session-live: session "…" has a live agent`，迁移空闲对话时也撞上同一个守卫。live-session 守卫按设计是对的——已加载 agent 的会话不能在其底下重写持久化产物——但 GUI 里打开对话的常态就是 live，于是用户打开过的每个对话都无法删除/迁移。

## 决策

proxy 已经在模块级 `agentHandles` map 里保留它创建/恢复的每个 agent 的 `AgentHandle`（由 `ensureSession`、remote-resolver 的 `onHandle` 和 fork 填充），`session.stop` 已经用它来 dispose live agent。`workspace.deleteSession` 和 `workspace.moveSession` 现在在操作前也做同样的事：当 `ctx.sessions.get(id)` 有值时查 `agentHandles`、dispose 该 handle（即 disposed-cause 取消、静默、scope 展开、registry 注销和 session store 移除），只有 session store 条目确实消失后才继续。本 proxy 不拥有的 live agent（无保留 handle）仍然保持原有 `session-live` 错误，所以对未跟踪 agent 的破坏性守卫依然成立；dispose 失败映射为 `internal`，与 `session.stop` 完全一致。

## 备选方案

**给 `AgentRegistry` 加 `stop(id)`**——在注册表上做通用的按 id 停止，在 `create`/`resume` 内部跟踪 handle。否掉：proxy 已经拥有这一职责——`agentHandles` map 和 `session.stop` 的存在正是因为设计上把 stop 限制在 proxy-owned agent（loop-owned 的配置 agent 或 subagent 没有 handle，不能强行 dispose）。再加一个注册表级机制会重复这条 seam，并把 stop 扩大到超出其意图的范围。

## 影响

delete 和 move 现在对 live 的空闲对话可用——这正是 GUI 为用户打开的会话暴露的两个操作。停止运行中的 agent 会取消其当前 turn（disposed-cause cancel 本来就是 loop 的优雅拆除）。服务重启后浏览器通过 proxy 的 create/resume 路径重新附加打开的会话，其 handle 会被再次保留，操作就能成功。未跟踪的 agent 仍然报 `session-live`，而不是被未知调用方强行 dispose。

`pnpm run typecheck` 和 apiproxy 套件（382 个测试）全部通过；workspace spec 新增了对 dispose-first 路径和不变 `session-live` 守卫的覆盖。
