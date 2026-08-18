# @deepseek-ai/dsh-client-ui-workbench

English | [中文](README.zh.md)

Web workspace workbench: the read-only inspection surface behind the sidebar browser's 文件 / 变更 modes. The package registers three seats. FilesView fills `sidebar.workspaces.files` with a lazy one-request-per-level file tree (hidden-file toggle, manual refresh, no watching or polling). ChangesView fills `sidebar.workspaces.changes` with the workspace's complete uncommitted Git status, grouped staged / unstaged / untracked with the branch and ahead/behind counts in the header. PreviewView fills the details column's `conversation.details.workspacePreview` seat: a file opens as bounded, language-highlighted text in `CodeBlock`; a change opens as old/new text in `DiffBlock` with a 暂存区 / 工作区 basis switch. Clicking a file in either sidebar view calls the injected `openPreview`, the layout store carries the target, and the details column shows the preview instead of tool details until the column closes.

Every Host read goes through the runtime workspace-inspection face, which the Host constrains to the registered workspace root (relative paths only, `.git` hidden, binary and oversized content rejected). All requests are abortable, and a superseded request never writes its view. The browser never receives an absolute host path, and no editing, staging, committing, or discarding action exists.

## Model Experience

None, as the workbench is a browser-side read-only inspection surface that registers no tool, prompt, or session event.

#### KV Cache effect

None: no model request changes.

## Known Limitations and Deferred Work

- **No live refresh** — the tree and the status update on manual refresh, mode entry, or workspace switch only; file watching and background polling are deliberately out of scope.
- **Preview requires a selected session** — the current workspace derives from the current session, so the views show their empty state while no session is selected.
- **Text and size bounds are fixed** — the Host inspector's entry count, text byte, and Git output caps are not configurable per deployment.
