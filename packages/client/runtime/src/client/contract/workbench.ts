/**
 * Cross-plugin workbench vocabulary: the read-only preview target shared by
 * the workspace workbench (sidebar Files/Changes views) and the details
 * column preview. Plain JSON data — owner props and store state legal.
 */
import type { WorkspaceId } from '@deepseek-ai/dsh-api-remotes/client'

/** What the details column should preview instead of tool-call details. */
export type WorkspacePreviewTarget =
  | { readonly kind: 'file'; readonly workspaceId: WorkspaceId; readonly path: string }
  | { readonly kind: 'git-diff'; readonly workspaceId: WorkspaceId; readonly path: string; readonly basis: 'staged' | 'worktree' }
