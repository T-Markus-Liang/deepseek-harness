/**
 * Workbench plugin, browser half. Three registrations, each through
 * slots.inject (the declaring applies are NOT order-constrained relative to
 * this one): FilesView and ChangesView fill the sidebar browser's Files /
 * Changes child seats declared by ui-workspace, PreviewView fills the details
 * column's workspace-preview seat declared by ui-conversation. Selection
 * flows through ctx.layout's preview target; every Host read goes through
 * the runtime workspace-inspection face (read-only, workspace-constrained).
 * Export discipline: packages/client/AGENTS.md.
 */
import type { ClientContext, WorkspacePreviewTarget } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pull the service Context merges (ctx.locale / ctx.layout).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { WorkbenchInjected } from './contract/slots.ts'
import { createWorkbenchStore } from './stores.ts'
import { FilesView } from './FilesView.tsx'
import { ChangesView } from './ChangesView.tsx'
import { PreviewView } from './PreviewView.tsx'
import { en, zh, type WorkbenchKey } from './locales.ts'

export type { ChangesViewProps, FilesViewProps, PreviewViewProps, WorkbenchInjected } from './contract/slots.ts'
export type { WorkbenchKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The workspace workbench views and preview copy. */
    workbench: WorkbenchKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'workbench'

/** Services required by the workbench plugin. */
export const inject = ['slots', 'workspaces', 'layout', 'locale']

/**
 * Register the three workbench seats once their slot declarations are on the
 * ledger. The inject callbacks are closure constants, so components see
 * stable identities across renders.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-workbench: dictionaries')

  const listTreeLevel: WorkbenchInjected['listTreeLevel'] = (workspaceId, path, signal) =>
    ctx.workspaces.listTreeLevel(workspaceId, path, signal)
  const readFilePreview: WorkbenchInjected['readFilePreview'] = (workspaceId, path, signal) =>
    ctx.workspaces.readFilePreview(workspaceId, path, signal)
  const gitStatus: WorkbenchInjected['gitStatus'] = (workspaceId, signal) =>
    ctx.workspaces.gitStatus(workspaceId, signal)
  const gitFileDiff: WorkbenchInjected['gitFileDiff'] = (workspaceId, path, basis, signal) =>
    ctx.workspaces.gitFileDiff(workspaceId, path, basis, signal)
  const openPreview = (target: WorkspacePreviewTarget): void => { ctx.layout.openPreview(target) }
  const closePreview = (): void => { ctx.layout.closeDetails() }
  const injected = (): WorkbenchInjected => ({
    listTreeLevel, readFilePreview, gitStatus, gitFileDiff, openPreview, closePreview,
  })

  // One viewing store shared by both sidebar seats (expansion and the
  // hidden-file toggle survive a mode switch).
  const workbenchStore = createWorkbenchStore()

  ctx.slots.inject('sidebar.workspaces.files', () => ctx.slots.register(
    {
      name: 'sidebar.workspaces.files',
      store: workbenchStore,
      inject: injected,
      locale: NS,
    },
    FilesView,
  ))
  ctx.slots.inject('sidebar.workspaces.changes', () => ctx.slots.register(
    {
      name: 'sidebar.workspaces.changes',
      store: workbenchStore,
      inject: injected,
      locale: NS,
    },
    ChangesView,
  ))
  ctx.slots.inject('conversation.details.workspacePreview', () => ctx.slots.register(
    {
      name: 'conversation.details.workspacePreview',
      inject: injected,
      locale: NS,
    },
    PreviewView,
  ))
}
