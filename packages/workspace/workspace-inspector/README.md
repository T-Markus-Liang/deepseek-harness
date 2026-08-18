# @deepseek-ai/dsh-workspace-inspector

English | [中文](README.zh.md)

Host-side read-only inspection service behind the Web workbench's Files / Changes views and the details-column preview. Every method resolves a workspace-relative path against one registered workspace root through `ctx.fs` (containment-checked, symlink-safe) or runs Git through `ctx.subprocess` with a fixed, parameterized argv — user input never reaches a shell. `listTreeLevel` returns one directory level with `.git` filtered and an entry-count truncation flag; `readFilePreview` returns bounded UTF-8 text with a language hint, rejecting binary, non-regular, and oversized files; `gitStatus` parses porcelain v1 into branch, ahead/behind, and every uncommitted file; `gitFileDiff` expresses one path's staged or worktree change as old/new text for the browser's diff renderer. Failures are `WorkspaceInspectorError` values whose codes are stable wire vocabulary for the browser's error states.

The service deliberately offers no write, stage, commit, discard, fetch, or pull operation, and no watching or polling — every call is one explicit read.

## Model Experience

None, as the service answers browser-side read-only inspection requests and registers no tool, prompt, or session event.

#### KV Cache effect

None: no model request changes.

## Known Limitations and Deferred Work

- **Bounds are fixed in code** — the entry count, text byte, and Git output caps are compile-time constants, not per-deployment configuration. A status that exceeds the Git output cap returns the complete records retained under the cap with `truncated: true` (the branch header can be cut away); text bases still fail because a cut payload would corrupt the diff.
- **No live invalidation** — callers refresh explicitly; the service owns no file watching or cache.
