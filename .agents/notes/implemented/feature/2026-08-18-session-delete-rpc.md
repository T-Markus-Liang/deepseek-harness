# Agent Note: Permanent session deletion via workspace.deleteSession

Status: implemented

English | [中文](2026-08-18-session-delete-rpc.zh.md)

## Problem

The GUI could archive sessions but never remove them: persisted artifacts, workspace accounting, and archive-set entries accumulated forever. Deletion had to be permanent without endangering live or subagent-owned sessions, and every surface (listings, grouping, archive set) had to drop the id in one operation.

## Decision

Deletion is one unary RPC, `workspace.deleteSession`, guarded by three typed failures: a session with a live agent fails `session-live`, a subagent-origin session (`SessionHeader.origin === 'subagent'`) fails `session-subagent`, and an id absent from persistence fails `session-not-found`. On success the proxy runs `sessionPersistence.destroy(id)` — a new backend contract implemented by the JSONL and SQLite backends to physically remove every artifact of one session, idempotent over missing artifacts — and then `workspaceRegistry.unaccountSession(id)`, which detaches the id from every workspace's accounting and from the registry-global archive set. The response echoes the deleted `sessionId`. New RPC error codes `session-live` / `session-subagent` joined `RpcErrorDetailsMap` and the error schema; the settings panel now renders through a body portal (a separate client change carrying the package's `react-dom` devDependency declaration).

## Alternatives considered

**Soft-delete markers** lost because they keep every artifact on disk forever and force every listing to filter; the archive set already covers reversible hiding.

**Letting the registry own the physical removal** lost because persistence backends own their on-disk layouts; the registry only unaccounts.

**Deleting live sessions by force-detaching** lost on safety: an agent mid-turn would keep appending to artifacts that no longer exist, so the RPC refuses and the caller detaches first.

## Consequences

Any caller with RPC access can irreversibly delete a detached, top-level session; live and subagent-owned sessions are structurally protected. Blank but persisted sessions delete like any other. The GUI exposes the delete affordance through the session row's actions and right-click menus (删除, danger-styled) behind an irreversible-delete confirmation dialog; on success the client runtime (`SessionRuntime.deleteSession`) removes the row from the list store and clears a selection that pointed at it, while `unaccountSession`'s state change re-pushes the archive set to every tab through the existing `host/archived-sessions-changed` frame. Blank rows carry no verbs, so their right-click stays inert.

`pnpm run typecheck`, `pnpm run test:gui` (273 files, 3,786+ tests, including the new session-delete dialog, right-click, and list-removal cases), the apiproxy + session suites (62 files, 1,304 tests), and `pnpm run doc-sync` (28 gates) all pass with the wiring complete.
