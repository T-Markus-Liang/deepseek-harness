/**
 * ui-workbench contracts. Three registrations share this package:
 *
 * - FilesView fills the sidebar browser's `sidebar.workspaces.files` hole
 *   (read-only workspace file tree, one lazy level per request).
 * - ChangesView fills `sidebar.workspaces.changes` (read-only Git status,
 *   grouped staged / unstaged / untracked).
 * - PreviewView fills the details column's
 *   `conversation.details.workspacePreview` hole (file content or Git diff).
 *
 * Selection flows one way: the sidebar views call the injected `openPreview`
 * (ctx.layout), the layout store carries the target, and AppFrame hands it to
 * the details occupant as an owner prop.
 */
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pull the owner SlotMap merges into programs that resolve the
// runtime shares below.
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {
  WorkspaceFilePreview, WorkspaceGitDiff, WorkspaceGitStatus, WorkspaceId,
  WorkspacePreviewTarget, WorkspaceTreeLevel,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { createWorkbenchStore } from '../stores.ts'

/**
 * Injected share of all three workbench seats: plain callbacks over the
 * runtime workspace-inspection face plus the two layout panel verbs. Every
 * fetch takes an AbortSignal; the views abort superseded requests.
 */
export interface WorkbenchInjected {
  /** List one directory level under the workspace root. */
  listTreeLevel: (workspaceId: WorkspaceId, path: string, signal: AbortSignal) => Promise<WorkspaceTreeLevel>
  /** Read a text file preview (bounded, binary-rejecting). */
  readFilePreview: (workspaceId: WorkspaceId, path: string, signal: AbortSignal) => Promise<WorkspaceFilePreview>
  /** Read the workspace Git status (all uncommitted changes). */
  gitStatus: (workspaceId: WorkspaceId, signal: AbortSignal) => Promise<WorkspaceGitStatus>
  /** Read one file's staged or worktree diff as old/new text. */
  gitFileDiff: (workspaceId: WorkspaceId, path: string, basis: 'staged' | 'worktree', signal: AbortSignal) => Promise<WorkspaceGitDiff>
  /** Open the details column on a workbench preview target. */
  openPreview: (target: WorkspacePreviewTarget) => void
  /** Close the details column (drops the preview with it). */
  closePreview: () => void
}

/** Full Files view props: runtime hooks + viewing store + injected face + locale. */
export type FilesViewProps =
  PropsRuntime<'sidebar.workspaces.files'>
  & PropsStore<ReturnType<typeof createWorkbenchStore>>
  & WorkbenchInjected
  & PropsLocale<'workbench'>

/** Full Changes view props: same shares as the Files view. */
export type ChangesViewProps =
  PropsRuntime<'sidebar.workspaces.changes'>
  & PropsStore<ReturnType<typeof createWorkbenchStore>>
  & WorkbenchInjected
  & PropsLocale<'workbench'>

/** Full preview props: the owner-passed target plus the injected face and locale. */
export type PreviewViewProps =
  PropsRuntime<'conversation.details.workspacePreview'>
  & WorkbenchInjected
  & PropsLocale<'workbench'>
