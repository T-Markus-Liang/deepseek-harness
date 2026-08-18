# Agent Note: Read-only workspace workbench

Status: implemented

English | [中文](2026-08-18-workspace-workbench.zh.md)

## Problem

The Web GUI showed only sessions and conversation. Reviewing the current workspace's files or its uncommitted Git changes required leaving the app, and no Host capability exposed either surface to the browser. A direct host-path file API would have handed the browser arbitrary-read access to the machine, and any Git integration had to stay read-only to keep write authority with the agent's explicit tool calls.

## Decision

The feature ships as one Host capability plus three browser seats, all constrained to a registered workspace root. The new `dsh-workspace-inspector` package (Host side) resolves `workspaceId +` workspace-relative paths through `ctx.fs` with containment checks, filters `.git`, rejects root escapes, binary files, and oversized content, and runs Git through `ctx.subprocess` with fixed, parameterized argv (`GIT_OPTIONAL_LOCKS=0`, no pager, no terminal prompts). Four unary RPC methods — `workspace.listTreeLevel`, `workspace.readFilePreview`, `workspace.gitStatus`, `workspace.gitFileDiff` — expose it through the API proxy, the fetch carrier, and the runtime `IWorkspaces` face; diffs travel as old/new text pairs so the browser reuses the existing `DiffBlock` primitive.

On the client, ui-workspace's browser gains a 会话 / 文件 / 变更 mode switch persisted in its viewing store and declares two child seats; the new `ui-workbench` package fills them with a lazy one-request-per-level file tree and a grouped staged / unstaged / untracked status view. Selection flows through a new `WorkspacePreviewTarget` contract type and a `preview` field in the layout store: `ctx.layout.openPreview(target)` opens the details column, AppFrame passes the target as a details owner prop, and ui-conversation's DetailsPanel renders its new `conversation.details.workspacePreview` seat instead of tool details while a preview is set. Closing the column clears the target. Every fetch is abortable, superseded requests never write a view, and no editing, staging, committing, watching, or polling path exists.

## Alternatives considered

**A separate workbench package replacing the whole sidebar browser** lost because a slot has one occupant: replacing `sidebar.workspaces` would discard the session tree, search, and workspace dialogs, and the first revision of this package did exactly that before the mode-switch design replaced it.

**Embedding the preview inside the sidebar** lost because a 300px column cannot hold a readable diff and would duplicate the details column's open/close geometry; routing through the layout store reuses the existing panel machinery.

**Shelling out from the browser or accepting absolute paths** lost on the security boundary: the browser never sees a host path, and the inspector's relative-path validation runs on the Host before any filesystem or Git call.

**Live file watching and background polling** lost for the first version: manual refresh, mode entry, and workspace switch are the only refetch triggers, which keeps the read-only surface free of subscription lifecycle.

## Consequences

The sidebar switches between sessions, a workspace file tree, and the full uncommitted Git status without leaving the app; files and diffs open in the details column beside the conversation. Session logs, model context, tool permissions, and business execution are unchanged — the inspector answers reads only. The bounds (entry count, text bytes, Git output bytes) are compile-time constants, and preview requires a selected session because the workspace derives from it.

`pnpm run test:gui` passed 273 files and 3,786 tests. `pnpm run doc-sync` passed 28 gates. The shipped Web composition mounts `workspace-inspector` and `ui-workbench` through `packages/bundle/web-app/cordis.patch.yml`.
