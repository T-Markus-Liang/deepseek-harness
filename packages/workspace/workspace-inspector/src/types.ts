/** Public vocabulary for workspace-root-constrained inspection. */

/** One tree entry: workspace-relative path, base name, kind, optional byte size, dot-file flag. */
export interface WorkspaceTreeEntry {
  path: string
  name: string
  type: 'file' | 'directory' | 'other'
  size?: number
  hidden: boolean
}

/** One fetched directory level with the backend's truncation flag. */
export interface WorkspaceTreeLevel {
  path: string
  entries: WorkspaceTreeEntry[]
  truncated: boolean
}

/** Bounded text preview of one workspace file with its total byte size and optional language hint. */
export interface WorkspaceFilePreview {
  path: string
  text: string
  totalBytes: number
  language?: string
}

/** One changed file: porcelain index/worktree letters plus the rename source when present. */
export interface WorkspaceGitFile {
  path: string
  index: string
  worktree: string
  originalPath?: string
}

/** Whole-worktree Git status: branch, ahead/behind counts, and every uncommitted file. */
export interface WorkspaceGitStatus {
  branch?: string
  ahead: number
  behind: number
  files: WorkspaceGitFile[]
}

/** One file's diff as old/new text (oldText null = added on that basis). */
export interface WorkspaceGitDiff {
  path: string
  basis: 'staged' | 'worktree'
  oldText: string | null
  newText: string
}

/** Structured inspection failure; the code is stable wire vocabulary for the browser's error states. */
export class WorkspaceInspectorError extends Error {
  constructor(
    readonly code: 'workspace-invalid' | 'path-invalid' | 'path-outside-workspace' | 'file-not-found' | 'file-not-text' | 'file-too-large' | 'git-unavailable' | 'git-not-repository' | 'git-failed',
    message: string,
  ) {
    super(message)
    this.name = 'WorkspaceInspectorError'
  }
}
