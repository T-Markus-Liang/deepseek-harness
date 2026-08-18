/**
 * ChangesView: the read-only Git status filling the sidebar browser's
 * `sidebar.workspaces.changes` hole — every uncommitted change of the
 * current workspace, grouped staged / unstaged / untracked. Clicking a file
 * asks the details column for its diff on the matching basis.
 */
import { useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import type { WorkspaceGitFile, WorkspaceGitStatus } from '@deepseek-ai/dsh-client-runtime/client'
import type { ChangesViewProps } from './contract/slots.ts'
import type { WorkbenchKey } from './locales.ts'
import css from './Workbench.module.css'

/** Git status arrival state (idle = no workspace selected). */
type StatusState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: WorkspaceGitStatus }
  | { readonly status: 'error'; readonly message: string }

/** One porcelain group: its section title key, row basis, and status letter. */
interface ChangeGroup {
  readonly key: string
  readonly title: WorkbenchKey
  readonly basis: 'staged' | 'worktree'
  readonly files: readonly WorkspaceGitFile[]
  readonly letter: (file: WorkspaceGitFile) => string
}

/** Split porcelain rows into the three display groups. */
function groupFiles(files: readonly WorkspaceGitFile[]): ChangeGroup[] {
  const staged = files.filter(f => f.index !== ' ' && f.index !== '?')
  const unstaged = files.filter(f => f.index !== '?' && f.worktree !== ' ')
  const untracked = files.filter(f => f.index === '?')
  return [
    { key: 'staged', title: 'changes.staged' as const, basis: 'staged' as const, files: staged, letter: (f: WorkspaceGitFile) => f.index },
    { key: 'unstaged', title: 'changes.unstaged' as const, basis: 'worktree' as const, files: unstaged, letter: (f: WorkspaceGitFile) => f.worktree },
    { key: 'untracked', title: 'changes.untracked' as const, basis: 'worktree' as const, files: untracked, letter: () => '?' },
  ].filter(group => group.files.length > 0)
}

export function ChangesView({ useSessions, useWorkspaces, gitStatus, openPreview, t }: ChangesViewProps) {
  const current = useSessions(s => s.current)
  const workspace = useWorkspaces(s => (current === undefined ? undefined : s.items.find(w => w.sessionIds.includes(current))))
  const workspaceId = workspace?.workspaceId
  const [state, setState] = useState<StatusState>({ status: 'idle' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (workspaceId === undefined) {
      setState({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    setState({ status: 'loading' })
    gitStatus(workspaceId, controller.signal).then((data) => {
      if (controller.signal.aborted) return
      setState({ status: 'ready', data })
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return
      setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    })
    return () => { controller.abort() }
  }, [workspaceId, version, gitStatus])

  const renderBody = (): ReactNode => {
    if (workspaceId === undefined) return <div className={css.note}>{t('changes.noWorkspace')}</div>
    if (state.status === 'loading' || state.status === 'idle') return <div className={css.note}>{t('changes.loading')}</div>
    if (state.status === 'error') return <div className={css.errorNote}>{state.message}</div>
    const groups = groupFiles(state.data.files)
    if (groups.length === 0) return <div className={css.note}>{t('changes.clean')}</div>
    return groups.map(group => (
      <section key={group.key} className={css.group}>
        <div className={css.groupTitle}>
          {t(group.title)}
          <span className={css.groupCount}>{group.files.length}</span>
        </div>
        {group.files.map(file => (
          <button
            key={group.key + ':' + file.path}
            type="button"
            className={css.row}
            title={file.originalPath === undefined ? file.path : file.originalPath + ' → ' + file.path}
            onClick={() => {
              openPreview({ kind: 'git-diff', workspaceId, path: file.path, basis: group.basis })
            }}
          >
            <span className={clsx(css.statusLetter, group.key === 'staged' && css.statusStaged, group.key === 'untracked' && css.statusUntracked)}>
              {group.letter(file)}
            </span>
            <span className={css.rowName}>{file.path}</span>
          </button>
        ))}
      </section>
    ))
  }

  const branch = state.status === 'ready' ? state.data.branch : undefined
  const ahead = state.status === 'ready' ? state.data.ahead : 0
  const behind = state.status === 'ready' ? state.data.behind : 0

  return (
    <div className={css.root}>
      <div className={css.header}>
        <span className={css.headerTitle}>
          {t('changes.title')}
          {branch !== undefined && <span className={css.branchBadge}>{branch}</span>}
          {(ahead > 0 || behind > 0) && (
            <span className={css.syncBadge}>
              {ahead > 0 ? `↑${ahead}` : ''}{behind > 0 ? `↓${behind}` : ''}
            </span>
          )}
        </span>
        <div className={css.headerActions}>
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('changes.refresh')}
            title={t('changes.refresh')}
            onClick={() => { setVersion(v => v + 1) }}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
              <path d="M13.5 8a5.5 5.5 0 1 1-1.61-3.89M13.5 2.5v2.8h-2.8" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      {state.status === 'ready' && state.data.truncated && <div className={css.note}>{t('changes.truncated')}</div>}
      <div className={css.body}>{renderBody()}</div>
    </div>
  )
}
