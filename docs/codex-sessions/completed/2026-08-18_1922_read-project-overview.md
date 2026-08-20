# Read project overview

English | [中文](2026-08-18_1922_read-project-overview.zh.md)

- Date: 2026-08-18 19:22 CST
- Session id: `01a01499-e19a-7441-9f32-ef8932f3e3f7`
- Project: DeepSeek Harness
- Workspace: `/Users/markus/deepseek-harness`
- Task: Read the repository and establish an initial project understanding.
- Status: Completed
- Branch: `master` tracking `personal/master`

## User request summary

Read the project first and provide an initial understanding without changing product code.

## Work done

- Read `README.md`, `docs/architecture.md`, `docs/development.md`, `packages/README.md`, the root package manifest, workspace configuration, and representative group READMEs.
- Inspected CLI and Web entry points, recent commits, package and test inventory, and working-tree status.
- Ran a bounded read-only DeepSeek worker exploration and cross-checked its result.
- The native explorer subagent was attempted but failed because the service reported high demand; no repository files were changed by it.

## Decisions

- Treat the repository as a Cordis-composed plugin runtime, not as a monolithic chat application.
- Use the CLI/profile/bundle composition, agent loop, durable session log, capability seams, and Host/Client Web split as the primary mental model.
- Do not run build or test suites for a read-only orientation task; the working tree was clean before session-log updates.

## Current state

- The repository is at version `0.1.0-rc.7` and explicitly remains in developer preview.
- The source tree contains 49 package groups and 228 package manifests under `packages/`.
- Recent master commits focus on the read-only Web workspace workbench, workspace inspector wiring, and the Black Whale visual system.
- Product code is unchanged; only resumable Codex session metadata was added.
- No build or test command was needed for this read-only orientation. The bounded worker completed successfully after reading the repository, and the initial Git worktree was clean.

## Resume instructions

1. Read this log and `docs/codex-sessions/index.md`.
2. For architecture work, start with `docs/architecture.md`, then the relevant `packages/<group>/README.md` and package README.
3. Before changing lifecycle, concurrency, subprocess, or teardown code, read `docs/defensive-patterns.md`.
4. Select focused checks for the changed surface rather than running the entire suite by default.

## Open questions

- The user has not yet selected a subsystem or concrete change for deeper work.
