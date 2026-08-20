# Implement LLM-as-a-Verifier integration

English | [中文](2026-08-18_1949_implement-llm-verifier.zh.md)

- Date: 2026-08-18 19:49 CST
- Session id: `01a01499-e19a-7441-9f32-ef8932f3e3f7`
- Project: DeepSeek Harness
- Workspace: `/Users/markus/deepseek-harness`
- Task: Implement the approved staged LLM-as-a-Verifier integration.
- Status: Completed
- Branch: `master` tracking `personal/master`

## User request summary

Implement the previously recommended stages: a version-pinned Python JSON bridge with fake-bridge coverage for selection, cancellation, credentials, and output limits; a `verify_candidates` tool that ranks existing candidate sessions; and an automatic best-of-N workflow with isolated candidate workspaces. Defer online progress injection through `agent/turn-stopping` until these stages are complete.

## Continues from

- `/Users/markus/deepseek-harness/docs/codex-sessions/completed/2026-08-18_1932_assess-llm-verifier-integration.md`

## Work done

- Confirmed the requested three implementation stages and the explicit deferral of online turn-stopping feedback.
- Loaded repository instructions for subprocess/concurrency changes, packages, documentation, Agent Notes, and prose.
- Ran `deepseek-worker --json doctor`; the external worker runtime is healthy.
- Added the `verifier` Service Definition and a Python provider pinned to `llm-verifier==0.2.0` at upstream commit `115de305f23ed89bc42e86e010853c40059f3f7d`.
- Implemented an embedded, bounded JSON bridge with explicit credential resolution, ambient credential-shaped environment scrubbing, private operation directories, strict protocol/result validation, independent stdout/stderr byte limits, and process-tree cancellation.
- Added fake-bridge subprocess tests for selection, cancellation, missing and forwarded credentials, stdout/stderr overflow, and malformed or version-mismatched results.
- Added `verify_candidates`, which reconstructs complete model-visible trajectories from authorized durable Sessions, rejects missing or cross-workspace candidates uniformly, enforces configured limits without truncation, and returns verifier rankings by Session id.
- Added `best_of_n`, which requires a clean parent Git worktree, creates detached worktrees at the same HEAD, runs one-shot subagents in isolated workspace cwd values, verifies complete local Session trajectories, and promotes only the winner's binary patch after rechecking the parent HEAD and status.
- Extended the subagent capability and in-process providers with an explicit absolute `workspaceCwd` request, including provider capability rejection and child Session cwd propagation.
- Added package composition, generated catalogs and graphs, bilingual subsystem/package documentation, a keyless assembled snapshot, and the Agent Note `.agents/notes/implemented/feature/2026-08-18-llm-verifier-best-of-n.md`.
- Verified that `packages/core/agent/src/runtime-types.ts` and `agent/turn-stopping` remain unchanged.
- The delegated external worker timed out and misattributed concurrent documentation changes to itself; its result was rejected and no automatic rerun was used.
- Verification results:
  - `pnpm exec vitest run packages/verifier packages/subagent/subagent/tests/workspace-cwd.spec.ts`: 6 files and 18 tests passed.
  - `pnpm exec tsc -b packages/verifier/verifier packages/verifier/verifier-python packages/verifier/tool-verify-candidates packages/verifier/tool-best-of-n`: passed.
  - `pnpm exec vitest run --config vitest.snapshot.config.ts examples/headless-agent/tests/verifier.snapshot.ts`: 1 snapshot test passed.
  - `pnpm run doc-sync`: 28 gates passed.
  - `pnpm run verify-translation-pairing`: 966 pairs passed.
  - focused `pnpm exec oxlint` over verifier and changed subagent files: passed.
  - `git diff --check`: passed.
  - `pnpm run lint`: the verifier changes pass; the repository-wide command remains blocked only by the pre-existing `packages/host/apiproxy/src/fetch/handler.ts:188` `no-unnecessary-type-parameters` finding.

## Decisions

- Keep candidate generation separate from verifier scoring.
- Use a pinned Python subprocess behind an explicit bounded JSON protocol.
- Rank durable existing sessions before adding automatic candidate generation.
- Treat the caller Session cwd as the authorization scope for `verify_candidates`; do not send arbitrary persisted Sessions to an external verifier.
- Preserve the winning detached worktree when patch extraction, parent-state validation, or patch application fails so manual recovery remains possible.
- Do not let cleanup failures replace an earlier promotion error; report both while retaining the primary failure.
- Do not change `packages/core/agent/src/runtime-types.ts` during these stages.

## Current state

- All three requested stages are implemented and covered by focused tests, a keyless assembled snapshot, generated documentation, and type checks.
- Online progress feedback through `agent/turn-stopping` remains intentionally deferred.
- The only repository-wide lint failure is an unrelated pre-existing finding in `packages/host/apiproxy/src/fetch/handler.ts:188`.

## Resume instructions

1. Read this log, the verifier subsystem documentation, and the Agent Note.
2. Review `packages/verifier/` and the `workspaceCwd` additions under `packages/subagent/`.
3. Fix the unrelated Host lint finding separately if a fully clean repository-wide lint run is required.
4. Treat online `agent/turn-stopping` progress as a separate future change with its own design and snapshot coverage.

## Open questions

- None for the requested three stages.
