---
Date: 2026-08-20
Session id: 2026-08-20_1300_restore-session-lifecycle
Project: deepseek-harness
Workspace: /Users/markus/deepseek-harness
Task: Restore pre-0.8.0 local session lifecycle features on the rc.8 persistence API
Status: active
Branch: master
---

## User request

Restore session delete, move, stop/agent-handle tracking, and archive management one feature at a time, with focused tests and documentation, using the rc.8 persistence interface and no old `destroy`/`relocate` compatibility layer. Remove the accidentally regenerated FCC-derived `llm-openai` module.

## Work done

Inspected the rc.8 persistence, workspace, and API proxy implementations and identified the current `SessionPersistenceAdmin.destroy/relocate` service as the legacy layer to replace. Existing stop, delete/move, and archive code is present but needs lifecycle API cleanup and verification.

## Current state

The worktree contains unrelated session-log changes and an accidentally regenerated untracked `llm-openai` module. Lifecycle refactor has not started.

## Resume instructions

First remove the untracked FCC-derived packages and lock/profile references. Then replace `SessionPersistenceAdmin.destroy/relocate` with semantic rc.8 persistence lifecycle operations, update workspace/API consumers and focused tests/docs, and commit each feature independently.

## Open questions

Confirm whether the semantic persistence methods should be named `remove`/`move` on `SessionPersistence` and coordinator, with no compatibility aliases.
