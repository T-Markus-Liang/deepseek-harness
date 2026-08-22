# Changelog

## [0.1.0] - 2026-08-22

### Compatibility

- Verified against DSH `0.1.0-rc.8` (installed profile) and upstream `dsh-v0.1.1-rc.2`:
  - `SubagentStartRequest.agentOptions`, `subagents.start('spawn'|'fork', ...)`, `run.result`/`run.dispose` unchanged.
  - Agent-scoped `agent.ctx.tools.register`, `agent/created`/`agent/disposed`, and `settings.register` unchanged.
  - `window.__ModuleLoader__` and the `settings.plugin.item` slot contract unchanged.
  - Upstream removed `SubagentStartRequest.workspaceCwd` (one-shot cwd override); this plugin never used it.
- Peer dependency ranges widened to accept the `0.1.1-rc.x` line.

### Added

- Deterministic explicit subagent tools for normal Flash, Flash fork, Terra review, and Command Code DeepSeek V4 Visual Flash Exp work.
- Explicit per-child `agentOptions`, so subagent routes no longer inherit the parent agent's creation-time model.
- Economy policy defaults with editable normal, reviewer, and visual routes.
- Web settings card with overview, future preset visibility, advanced route editing, and migration confirmation state.
- Bounded in-memory route records (14 days or 100 entries) for host-side observability.
- Legacy migration preview contract that never silently modifies `fallbacks.roles` or `rootChain`.

### Verified

- Unit coverage for four tool registrations and all explicit model routes.
- Live Web settings card rendering on the local DSH profile.
