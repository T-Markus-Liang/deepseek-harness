/**
 * FilesView: the read-only workspace file tree filling the sidebar browser's
 * `sidebar.workspaces.files` hole. One Host request per expanded level
 * (lazily, abortable); clicking a text file asks the details column for a
 * preview through the injected openPreview.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import type { WorkspaceTreeLevel } from '@deepseek-ai/dsh-client-runtime/client'
import type { FilesViewProps } from './contract/slots.ts'
import css from './Workbench.module.css'

/** One fetched directory level's local arrival state. */
type LevelState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly level: WorkspaceTreeLevel }
  | { readonly status: 'error'; readonly message: string }

/** The 12px folder/file glyph column keeps names aligned across row kinds. */
function RowGlyph({ kind, open }: { kind: 'directory' | 'file' | 'other'; open: boolean }) {
  if (kind === 'directory') {
    return (
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
        <path d={open ? 'M4 6l4 4 4-4' : 'M6 4l4 4-4 4'} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return <span className={css.fileGlyph} aria-hidden />
}

export function FilesView({ useSessions, useWorkspaces, useStore, actions, listTreeLevel, openPreview, t }: FilesViewProps) {
  const current = useSessions(s => s.current)
  const workspace = useWorkspaces(s => (current === undefined ? undefined : s.items.find(w => w.sessionIds.includes(current))))
  const workspaceId = workspace?.workspaceId
  const expanded = useStore(s => s.expandedDirs)
  const showHidden = useStore(s => s.showHidden)
  const [levels, setLevels] = useState<Readonly<Record<string, LevelState>>>({})
  const [version, setVersion] = useState(0)
  const controllersRef = useRef(new Set<AbortController>())
  const expandedRef = useRef(expanded)
  useEffect(() => { expandedRef.current = expanded }, [expanded])

  // In-flight loads die with the seat (mode switch or plugin teardown).
  useEffect(() => () => {
    for (const controller of controllersRef.current) controller.abort()
  }, [])

  useEffect(() => {
    if (workspaceId === undefined) {
      setLevels({})
      return
    }
    const controller = new AbortController()
    controllersRef.current.add(controller)
    const load = (path: string): void => {
      setLevels(prev => ({ ...prev, [path]: { status: 'loading' } }))
      listTreeLevel(workspaceId, path, controller.signal).then((level) => {
        if (controller.signal.aborted) return
        setLevels(prev => ({ ...prev, [path]: { status: 'ready', level } }))
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLevels(prev => ({ ...prev, [path]: { status: 'error', message: error instanceof Error ? error.message : String(error) } }))
      })
    }
    // Refresh reloads the root plus every currently expanded directory; the
    // expansion itself is viewing state and survives.
    setLevels({})
    load('')
    for (const path of expandedRef.current) load(path)
    return () => {
      controller.abort()
      controllersRef.current.delete(controller)
    }
  }, [workspaceId, version, listTreeLevel])

  const toggleDir = (path: string): void => {
    if (workspaceId === undefined) return
    const willExpand = !expandedRef.current.includes(path)
    actions.toggleDir(path)
    if (!willExpand || levels[path] !== undefined) return
    const controller = new AbortController()
    controllersRef.current.add(controller)
    setLevels(prev => ({ ...prev, [path]: { status: 'loading' } }))
    listTreeLevel(workspaceId, path, controller.signal).then((level) => {
      if (controller.signal.aborted) return
      setLevels(prev => ({ ...prev, [path]: { status: 'ready', level } }))
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setLevels(prev => ({ ...prev, [path]: { status: 'error', message: error instanceof Error ? error.message : String(error) } }))
    }).finally(() => { controllersRef.current.delete(controller) })
  }

  const renderLevel = (path: string, depth: number): ReactNode => {
    const state = levels[path]
    if (state === undefined || state.status === 'loading') {
      return <div className={css.note} style={{ paddingLeft: 10 + depth * 14 }}>{t('files.loading')}</div>
    }
    if (state.status === 'error') {
      return <div className={css.errorNote} style={{ paddingLeft: 10 + depth * 14 }}>{state.message}</div>
    }
    const entries = state.level.entries.filter(entry => showHidden || !entry.hidden)
    if (entries.length === 0) {
      return <div className={css.note} style={{ paddingLeft: 10 + depth * 14 }}>{t('files.empty')}</div>
    }
    return entries.map((entry) => {
      const isDir = entry.type === 'directory'
      const isOpen = isDir && expanded.includes(entry.path)
      return (
        <div key={entry.path}>
          <button
            type="button"
            className={clsx(css.row, isOpen && css.rowOpen)}
            style={{ paddingLeft: 10 + depth * 14 }}
            title={entry.path}
            onClick={() => {
              if (isDir) { toggleDir(entry.path); return }
              if (workspaceId !== undefined) openPreview({ kind: 'file', workspaceId, path: entry.path })
            }}
          >
            <span className={css.rowGlyph}><RowGlyph kind={entry.type} open={isOpen} /></span>
            <span className={css.rowName}>{entry.name}</span>
          </button>
          {isDir && isOpen && renderLevel(entry.path, depth + 1)}
        </div>
      )
    })
  }

  return (
    <div className={css.root}>
      <div className={css.header}>
        <span className={css.headerTitle}>{t('files.title')}</span>
        <div className={css.headerActions}>
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('files.refresh')}
            title={t('files.refresh')}
            onClick={() => { setVersion(v => v + 1) }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path d="M13.5 8a5.5 5.5 0 1 1-1.61-3.89M13.5 2.5v2.8h-2.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className={clsx(css.iconButton, showHidden && css.iconButtonActive)}
            aria-label={showHidden ? t('files.hideHidden') : t('files.showHidden')}
            aria-pressed={showHidden}
            title={showHidden ? t('files.hideHidden') : t('files.showHidden')}
            onClick={() => { actions.setShowHidden(!showHidden) }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path d="M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4-6.5-4-6.5-4Z" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
        </div>
      </div>
      <div className={css.body}>
        {workspaceId === undefined
          ? <div className={css.note}>{t('files.noWorkspace')}</div>
          : renderLevel('', 0)}
      </div>
    </div>
  )
}
