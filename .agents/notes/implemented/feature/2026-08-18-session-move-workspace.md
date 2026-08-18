# Agent Note: Session relocation between workspaces via workspace.moveSession

Status: implemented

English | [中文](2026-08-18-session-move-workspace.zh.md)

## Problem

Sessions are permanently bound to the workspace whose path matches their creation-time `cwd`. Users who reorganize their projects (e.g. moving a repository to a dedicated directory) cannot bring existing conversations along — the sessions stay in the old workspace, showing the wrong Git status and file tree.

## Decision

A new unary RPC `workspace.moveSession(workspaceId, sessionId)` relocates a session by rewriting the persisted header `cwd` to the target workspace's path, then detaching from every workspace and attaching to the target. The operation is guarded by the same three failures as `deleteSession`: live sessions fail `session-live`, subagent-origin sessions fail `session-subagent`, unknown ids fail `session-not-found`, and an unknown target workspace fails `workspace-not-found`.

The persistence layer gains a `relocate(id, newCwd)` contract implemented by both backends: the SQLite backend issues a single `UPDATE sessions SET cwd = ?`; the JSONL backend reads the full log, swaps only the header line, publishes at the new cwd-derived path via the same atomic mechanism as `materialize`, then removes the old artifact. A crash between publish and cleanup leaves a duplicate that `listArtifacts` and `findLog` resolve by preferring the file with the newer mtime — the relocated copy was written most recently.

## Alternatives considered

**Workspace-only override (no cwd change)** lost because the session's file operations would still use the old directory while the GUI shows the new workspace — exactly the confusion the cwd-path invariant prevents.

**Fork-into-new-workspace** lost because fork creates a new session id, breaking any references to the original, and duplicates the event log.

**In-memory sessionPath override** lost because `indexHeader` re-derives the mapping from the persisted header on every startup, so the override would not survive restart.

## Consequences

Any caller with RPC access can relocate a detached, top-level session to any registered workspace. The session's subsequent file operations, skill filtering, and fork inheritance all use the new cwd. Events already in the log retain their original content (paths relative to the old cwd) but are never re-executed, so this is safe for forward-only continuation. The JSONL duplicate-recovery path (prefer newer mtime) weakens the integrity check for genuine duplicates — a genuine duplicate now resolves silently instead of failing loud.

`pnpm run typecheck`, `pnpm run test:gui` (273 files, 3,795 tests), the apiproxy + session + workspace suites (65 files, 1,355 tests), and `pnpm run doc-sync` (28 gates) all pass.
