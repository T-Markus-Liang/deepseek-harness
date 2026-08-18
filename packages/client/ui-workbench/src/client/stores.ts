/**
 * The workbench's viewing store: expanded directories and the hidden-file
 * toggle, shared by the Files and Changes seats (one handle passed to both
 * registers in apply). Module level exports the factory only — a module-level
 * handle would pin the store identity across plugin reloads.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'

/** Workbench viewing state (viewing only — business data stays in the Host). */
type WorkbenchViewState = {
  /** Workspace-relative directory paths currently expanded in the file tree. */
  expandedDirs: string[]
  /** True while dot-prefixed entries are shown. */
  showHidden: boolean
}

/** Annotation twin of the actions literal below (drift fails assignability). */
type WorkbenchViewActions = {
  toggleDir: (draft: WorkbenchViewState, path: string) => void
  setShowHidden: (draft: WorkbenchViewState, show: boolean) => void
}

/**
 * Create the workbench viewing store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createWorkbenchStore(): EngineStoreHandle<WorkbenchViewState, WorkbenchViewActions> {
  return defineStore({
    init: (): WorkbenchViewState => ({ expandedDirs: [], showHidden: false }),
    actions: {
      toggleDir: (d, path: string) => {
        d.expandedDirs = d.expandedDirs.includes(path)
          ? d.expandedDirs.filter(item => item !== path)
          : [...d.expandedDirs, path]
      },
      setShowHidden: (d, show: boolean) => { d.showHidden = show },
    },
  })
}
