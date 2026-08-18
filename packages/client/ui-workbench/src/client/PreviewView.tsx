/**
 * PreviewView: the details column's workspace workbench preview — a file's
 * bounded text (CodeBlock) or one path's Git diff (DiffBlock) with a
 * staged/worktree basis switch. Every fetch is abortable; a superseded
 * request never writes the pane.
 */
import { useEffect, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { CodeBlock, DiffBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceFilePreview, WorkspaceGitDiff } from '@deepseek-ai/dsh-client-runtime/client'
import type { PreviewViewProps } from './contract/slots.ts'
import css from './Workbench.module.css'

/** Preview content arrival state. */
type ContentState =
  | { readonly status: 'loading' }
  | { readonly status: 'file'; readonly preview: WorkspaceFilePreview }
  | { readonly status: 'diff'; readonly diff: WorkspaceGitDiff }
  | { readonly status: 'error'; readonly message: string }

/** CodeBlock language fallback: the Host hint, else the path extension. */
function languageOf(preview: WorkspaceFilePreview, path: string): string {
  if (preview.language !== undefined && preview.language !== '') return preview.language
  const dot = path.lastIndexOf('.')
  return dot === -1 ? '' : path.slice(dot + 1)
}

/** A diff taller than this many lines collapses its middle (DiffBlock cap). */
const PREVIEW_DIFF_MAX_LINES = 64

export function PreviewView({ target, readFilePreview, gitFileDiff, closePreview, t }: PreviewViewProps) {
  // Basis override keyed by target identity: a new target falls back to the
  // owner's basis; a manual switch survives only until the target changes.
  const [override, setOverride] = useState<{ readonly id: string; readonly basis: 'staged' | 'worktree' } | null>(null)
  const [content, setContent] = useState<ContentState>({ status: 'loading' })
  const targetIdentity = target.kind + ':' + target.workspaceId + ':' + target.path
  const basis = target.kind === 'git-diff'
    ? (override !== null && override.id === targetIdentity ? override.basis : target.basis)
    : 'worktree'
  const setBasis = (option: 'staged' | 'worktree'): void => { setOverride({ id: targetIdentity, basis: option }) }

  useEffect(() => {
    const controller = new AbortController()
    setContent({ status: 'loading' })
    const fail = (error: unknown): void => {
      if (controller.signal.aborted) return
      setContent({ status: 'error', message: error instanceof Error ? error.message : String(error) })
    }
    if (target.kind === 'file') {
      readFilePreview(target.workspaceId, target.path, controller.signal).then((preview) => {
        if (controller.signal.aborted) return
        setContent({ status: 'file', preview })
      }).catch(fail)
    } else {
      gitFileDiff(target.workspaceId, target.path, basis, controller.signal).then((diff) => {
        if (controller.signal.aborted) return
        setContent({ status: 'diff', diff })
      }).catch(fail)
    }
    return () => { controller.abort() }
  }, [target, basis, readFilePreview, gitFileDiff])

  const renderBody = (): ReactNode => {
    if (content.status === 'loading') return <div className={css.previewNote}>{t('preview.loading')}</div>
    if (content.status === 'error') return <div className={css.previewError}>{content.message}</div>
    if (content.status === 'file') {
      return (
        <CodeBlock
          code={content.preview.text}
          lang={languageOf(content.preview, target.path)}
          copyLabel={t('preview.copy')}
          copiedLabel={t('preview.copied')}
        />
      )
    }
    return (
      <DiffBlock
        diffs={[{ path: content.diff.path, oldText: content.diff.oldText, newText: content.diff.newText }]}
        maxLines={PREVIEW_DIFF_MAX_LINES}
      />
    )
  }

  return (
    <div className={css.previewRoot}>
      <div className={css.previewHeader}>
        <span className={css.previewPath} title={target.path}>{target.path}</span>
        {target.kind === 'git-diff' && (
          <div className={css.basisSwitch} role="group">
            {(['staged', 'worktree'] as const).map(option => (
              <button
                key={option}
                type="button"
                className={clsx(css.basisButton, basis === option && css.basisButtonActive)}
                aria-pressed={basis === option}
                onClick={() => { setBasis(option) }}
              >
                {option === 'staged' ? t('preview.basis.staged') : t('preview.basis.worktree')}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className={css.iconButton}
          aria-label={t('preview.close')}
          title={t('preview.close')}
          onClick={() => { closePreview() }}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className={css.previewBody}>{renderBody()}</div>
    </div>
  )
}
