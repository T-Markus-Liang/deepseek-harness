/** Public vocabulary for workspace-root-constrained inspection. */

export interface WorkspaceTreeEntry {
  path: string
  name: string
  type: 'file' | 'directory' | 'other'
  size?: number
  hidden: boolean
}

export interface WorkspaceTreeLevel {
  path: string
  entries: WorkspaceTreeEntry[]
  truncated: boolean
}

export interface WorkspaceFilePreview {
  path: string
  text: string
  totalBytes: number
  language?: string
}

export interface WorkspaceGitFile {
  path: string
  index: string
  worktree: string
  originalPath?: string
}

export interface WorkspaceGitStatus {
  branch?: string
  ahead: number
  behind: number
  files: WorkspaceGitFile[]
}

export interface WorkspaceGitDiff {
  path: string
  basis: 'staged' | 'worktree'
  oldText: string | null
  newText: string
}

export class WorkspaceInspectorError extends Error {
  constructor(
    readonly code: 'workspace-invalid' | 'path-invalid' | 'path-outside-workspace' | 'file-not-found' | 'file-not-text' | 'file-too-large' | 'git-unavailable' | 'git-not-repository' | 'git-failed',
    message: string,
  ) {
    super(message)
    this.name = 'WorkspaceInspectorError'
  }
}
