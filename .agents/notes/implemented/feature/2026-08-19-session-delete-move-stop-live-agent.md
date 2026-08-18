# Agent Note: deleteSession and moveSession dispose live agents via the proxy's retained handles

Status: implemented

English | [中文](2026-08-19-session-delete-move-stop-live-agent.zh.md)

## Problem

Deleting a conversation in the GUI failed with `session-live: session "…" has a live agent`, and migrating idle conversations hit the same guard. The live-session guard is correct by design — a session whose agent is loaded must not have its persisted artifacts rewritten underneath it — but the GUI's normal state for an open conversation IS live, so delete/move were unusable for every conversation the user had opened.

## Decision

The proxy already retains the `AgentHandle` of every agent it creates or resumes in the module-level `agentHandles` map (populated by `ensureSession`, the remote-resolver `onHandle`, and fork), and `session.stop` already uses it to dispose a live agent. `workspace.deleteSession` and `workspace.moveSession` now do the same before operating: when `ctx.sessions.get(id)` is populated they look up `agentHandles`, dispose the handle (a disposed-cause cancel, quiescence, scope unwind, registry unregistration, and session-store removal), and only proceed once the session store entry is gone. A live agent this proxy does not own (no retained handle) keeps the original `session-live` error, so the destructive guard still holds for untracked agents; a dispose failure maps to `internal` exactly as in `session.stop`.

## Alternatives considered

**Adding `AgentRegistry.stop(id)`** — a general stop-by-id on the agent registry, tracking handles inside `create`/`resume`. Lost because the proxy already owns exactly this responsibility: the `agentHandles` map and `session.stop` exist precisely because the design restricts stop to proxy-owned agents (a loop-owned config agent or subagent has no handle and must not be force-disposed). A second registry-level mechanism would duplicate that seam and widen stop beyond its intended scope.

## Consequences

Delete and move now work on live, idle conversations — the two operations the GUI exposes for the user's open sessions. Stopping an in-flight agent cancels its current turn (the disposed-cause cancel is already the loop's graceful teardown). After a service restart the browser re-attaches open sessions through the proxy's create/resume paths, so their handles are retained again and the operations succeed. Untracked agents still fail `session-live` rather than being force-disposed by an unknown caller.

`pnpm run typecheck` and the apiproxy suite (382 tests) pass; the workspace spec gains coverage for the dispose-first path and for the unchanged `session-live` guard.
