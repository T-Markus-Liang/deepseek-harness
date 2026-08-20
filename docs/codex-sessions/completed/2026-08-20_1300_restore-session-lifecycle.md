---
Date: 2026-08-20
Session id: 2026-08-20_1300_restore-session-lifecycle
Project: deepseek-harness
Workspace: /Users/markus/deepseek-harness
Task: Restore pre-0.8.0 local session lifecycle features on the rc.8 persistence API
Status: completed
Branch: master
---

## User request

Restore session delete, move, stop/agent-handle tracking, and archive management one feature at a time, with focused tests and documentation, using the rc.8 persistence interface and no old `destroy`/`relocate` compatibility layer. Remove the accidentally regenerated FCC-derived `llm-openai` module.

## Work done

- Replaced `SessionPersistenceAdmin.destroy/relocate` with semantic `ctx.sessionPersistence.remove/move` operations.
- Added coordinator lifecycle guards, per-session serialization, state invalidation, JSONL artifact moves/removal, and SQLite transactional row operations.
- Updated workspace delete/move consumers to use the rc.8 persistence service while retaining proxy-owned agent handle teardown and archive/accounting behavior.
- Updated backend, API proxy, client fixture, and contract tests; documented the lifecycle in English/Chinese README and subsystem docs.
- Removed the accidentally regenerated FCC-derived `packages/llm/llm-openai` and `packages/client/ui-settings-llm-openai` trees and their lock/bundle references; preserved recoverable copies under `/tmp/dsh-removed-fcc-module-20260820130503`.

## Verification

- Focused Vitest: 8 files, 468 tests passed.
- `pnpm run typecheck:contracts-ready` passed.
- Pre-commit lint, whitespace, vendor manifest, and third-party notice hooks passed for the three lifecycle commits.

## Commits

- `52e2db2a4b refactor(session): use rc8 persistence lifecycle operations`
- `8be7918887 test(session): cover restored lifecycle contracts`
- `164411e169 docs(session): document rc8 lifecycle ownership`

## Current state

Lifecycle restoration is complete. Existing unrelated worktree changes remain untouched, including the two deleted web probe files and prior completed-session artifacts.

## Resume instructions

Read this completed log, the three commits above, and `.agents/notes/implemented/architecture/2026-08-20-session-lifecycle-rc8.md` before any follow-up. Re-run the focused Vitest command if changing lifecycle code.

## Open questions

None for the requested restoration.
