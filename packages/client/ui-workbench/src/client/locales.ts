/** Workbench copy (Chinese primary; English fallback). */

/** Chinese dictionary (source of truth for the key set). */
export const zh = {
  'files.title': '文件',
  'files.refresh': '刷新',
  'files.showHidden': '显示隐藏文件',
  'files.hideHidden': '不显示隐藏文件',
  'files.noWorkspace': '当前没有选中的工作区',
  'files.loading': '加载中…',
  'files.empty': '空目录',
  'files.error': '文件树加载失败',
  'changes.title': '变更',
  'changes.refresh': '刷新',
  'changes.noWorkspace': '当前没有选中的工作区',
  'changes.loading': '加载中…',
  'changes.error': '变更状态加载失败',
  'changes.clean': '工作区没有未提交的改动',
  'changes.truncated': '改动数量超出读取上限，仅显示部分文件',
  'changes.staged': '已暂存的更改',
  'changes.unstaged': '未暂存的更改',
  'changes.untracked': '未跟踪的文件',
  'preview.copy': '复制',
  'preview.copied': '已复制',
  'preview.loading': '加载中…',
  'preview.error': '预览加载失败',
  'preview.basis.staged': '暂存区',
  'preview.basis.worktree': '工作区',
  'preview.close': '关闭预览',
}

/** Dictionary key union for the locale namespace merge. */
export type WorkbenchKey = keyof typeof zh

/** English dictionary (fallback). */
export const en = {
  'files.title': 'Files',
  'files.refresh': 'Refresh',
  'files.showHidden': 'Show hidden files',
  'files.hideHidden': 'Hide hidden files',
  'files.noWorkspace': 'No workspace selected',
  'files.loading': 'Loading…',
  'files.empty': 'Empty directory',
  'files.error': 'Failed to load the file tree',
  'changes.title': 'Changes',
  'changes.refresh': 'Refresh',
  'changes.noWorkspace': 'No workspace selected',
  'changes.loading': 'Loading…',
  'changes.error': 'Failed to load the change status',
  'changes.clean': 'No uncommitted changes',
  'changes.truncated': 'The change list hit the read limit; only part of the files is shown',
  'changes.staged': 'Staged Changes',
  'changes.unstaged': 'Unstaged Changes',
  'changes.untracked': 'Untracked Files',
  'preview.copy': 'Copy',
  'preview.copied': 'Copied',
  'preview.loading': 'Loading…',
  'preview.error': 'Failed to load the preview',
  'preview.basis.staged': 'Staged',
  'preview.basis.worktree': 'Worktree',
  'preview.close': 'Close preview',
} satisfies Record<WorkbenchKey, string>
