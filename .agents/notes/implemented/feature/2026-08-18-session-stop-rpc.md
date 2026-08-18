# Agent Note: session.stop releases a loaded agent so the session can be relocated

Status: implemented

English | [中文](2026-08-18-session-stop-rpc.zh.md)

## Problem

`workspace.moveSession` and `workspace.deleteSession` refuse a session with `session-live` whenever the session store holds a loaded entry. That check is intentionally the store, not the agent's running flag: a session whose agent is loaded but idle must not be moved or destroyed mid-lifecycle. But there was no way to release that agent on demand. The browser reconnects after a service restart and re-mounts its open sessions, so restarting the service did not make the stuck sessions migratable; `session.cancel` only pauses the active turn and deliberately keeps the agent.

## Decision

A new unary RPC `session.stop({ sessionId })` tears a loaded agent down through the exact `AgentHandle` the proxy retained when it created or resumed that session. `handle.dispose()` stops the loop and awaits its exit, unregisters the agent, removes its session from the store, and unwinds the scoped world — so a following `workspace.moveSession` no longer sees the session as live. The registry (`ctx.agents`) exposes no public dispose path, and the handle is a capability only its holder can use, so `createApiProxy` now keeps `Map<SessionId, AgentHandle>` filled at every `ctx.agents.create`/`resume` it issues (`ensureSession`).

Guards mirror the sibling destructive rows:

- no live agent → `session-not-found` (the session is already migratable).
- subagent-owned session → `session-subagent` (its teardown belongs to the delegating parent).
- a live agent this proxy did not create (loop-owned config agent) → `internal` ("does not own").

`session.stop` also aborts a running turn; callers must not stop the conversation currently driving them.

## Alternatives considered

**Expose a dispose path on AgentRegistry** lost because the registry deliberately does not retain the dispose closure — the handle is the whole teardown capability, and adding a registry-level teardown would let any holder of `ctx` stop agents it does not own.

**Reuse `session.cancel` with a stronger flag** lost because cancel preserves the inbox and keeps the agent for FIFO resume; releasing the agent is a structurally different lifecycle action that belongs on its own method.

**Restart-the-service workaround** (documented in the migration skill before this change) lost because the browser re-mounts open sessions on reconnect, so a restart does not release them.

## Consequences

Any caller with RPC access can stop any ordinary session it is allowed to reach; a running turn is aborted without a clean turn/end. The stopped session stays fully persisted and resumes normally later. The proxy now retains one handle per session it has created or resumed (bounded by the live session count; handles are dropped only implicitly — a future improvement could prune on `agent/disposed`).

`pnpm run typecheck`, the apiproxy suite (379 tests incl. 4 new `sessions.stop` cases), and `pnpm run doc-sync` all pass.
