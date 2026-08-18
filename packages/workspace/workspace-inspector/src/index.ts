/** Read-only workspace file-tree and Git inspection service. */

import { relative, sep } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import type { FsDirEntry, FsTarget } from '@deepseek-ai/dsh-fs'
import type { SubprocessOutputReader } from '@deepseek-ai/dsh-subprocess'
import { WorkspaceInspectorError, type WorkspaceFilePreview, type WorkspaceGitDiff, type WorkspaceGitFile, type WorkspaceGitStatus, type WorkspaceTreeEntry, type WorkspaceTreeLevel } from './types.ts'

export type { WorkspaceFilePreview, WorkspaceGitDiff, WorkspaceGitFile, WorkspaceGitStatus, WorkspaceTreeEntry, WorkspaceTreeLevel } from './types.ts'
export { WorkspaceInspectorError } from './types.ts'

/** Maximum direct children returned by one tree request. */
export const MAX_ENTRIES = 1000
/** Maximum UTF-8 bytes returned by a text or Git basis request. */
export const MAX_TEXT_BYTES = 512 * 1024
/** Maximum collected output from one Git command. */
export const MAX_GIT_OUTPUT_BYTES = 1024 * 1024

export const inject = ['fs', 'subprocess']

declare module '@deepseek-ai/cordis' { interface Context { workspaceInspector: WorkspaceInspector } }

function relativePosix(path: string): string { return path.split(sep).join('/') }
function languageFor(path: string): string | undefined {
  const lower = path.toLowerCase()
  if (lower.endsWith('.tsx')) return 'tsx'
  if (lower.endsWith('.ts')) return 'ts'
  if (lower.endsWith('.jsx')) return 'jsx'
  if (lower.endsWith('.js') || lower.endsWith('.mjs')) return 'js'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.md')) return 'markdown'
  if (lower.endsWith('.css')) return 'css'
  if (lower.endsWith('.html')) return 'html'
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'yaml'
  if (lower.endsWith('.py')) return 'python'
  if (lower.endsWith('.go')) return 'go'
  if (lower.endsWith('.rs')) return 'rust'
  return undefined
}

/** Reads only descendants of one registered workspace root. */
export class WorkspaceInspector extends Service {
  static inject = ['fs', 'subprocess']
  constructor(ctx: Context) { super(ctx, 'workspaceInspector') }

  async listTreeLevel(workspacePath: string, path = '', signal?: AbortSignal): Promise<WorkspaceTreeLevel> {
    const resolved = await this.resolveDescendant(workspacePath, path, signal)
    const info = await this.ctx.fs.stat(resolved.target, signal)
    if (info === undefined || info.type !== 'directory') throw new WorkspaceInspectorError('path-invalid', 'requested path is not a directory')
    const listed = await this.ctx.fs.listDir(resolved.target, signal)
    const entries: WorkspaceTreeEntry[] = []
    let truncated = false
    for (const entry of listed) {
      const childPath = this.relativeChild(resolved.root, entry)
      if (childPath === '.git' || childPath.startsWith('.git/')) continue
      if (entries.length >= MAX_ENTRIES) { truncated = true; break }
      entries.push({ path: childPath, name: entry.name, type: entry.type, ...(entry.size === undefined ? {} : { size: entry.size }), hidden: entry.name.startsWith('.') })
    }
    return { path: resolved.path, entries, truncated }
  }

  async readFilePreview(workspacePath: string, path: string, signal?: AbortSignal): Promise<WorkspaceFilePreview> {
    const resolved = await this.resolveDescendant(workspacePath, path, signal)
    const info = await this.ctx.fs.stat(resolved.target, signal)
    if (info === undefined) throw new WorkspaceInspectorError('file-not-found', 'file does not exist')
    if (info.type !== 'file') throw new WorkspaceInspectorError('file-not-text', 'only regular files can be previewed')
    if ((info.size ?? 0) > MAX_TEXT_BYTES) throw new WorkspaceInspectorError('file-too-large', 'file exceeds the preview limit')
    let text: string
    try { text = await this.ctx.fs.readText(resolved.target, signal) } catch { throw new WorkspaceInspectorError('file-not-text', 'file is not UTF-8 text') }
    const bytes = new TextEncoder().encode(text).byteLength
    if (bytes > MAX_TEXT_BYTES) throw new WorkspaceInspectorError('file-too-large', 'file exceeds the preview limit')
    const language = languageFor(resolved.path)
    return { path: resolved.path, text, totalBytes: info.size ?? bytes, ...(language === undefined ? {} : { language }) }
  }

  async gitStatus(workspacePath: string, signal?: AbortSignal): Promise<WorkspaceGitStatus> {
    const output = await this.git(workspacePath, ['status', '--porcelain=v1', '-z', '-b', '--untracked-files=all'], signal)
    const records = output.split('\0')
    let branch: string | undefined
    let ahead = 0
    let behind = 0
    const files: WorkspaceGitFile[] = []
    for (let index = 0; index < records.length; index++) {
      const record = records[index]
      if (record === undefined || record === '') continue
      if (record.startsWith('## ')) {
        const line = record.slice(3)
        const branchMatch = line.match(/^([^ .]+)(?:\.\.\.[^ ]+)?/)
        if (branchMatch?.[1] !== undefined && branchMatch[1] !== 'HEAD') branch = branchMatch[1]
        const aheadMatch = line.match(/ahead (\d+)/)
        const behindMatch = line.match(/behind (\d+)/)
        ahead = Number(aheadMatch?.[1] ?? 0)
        behind = Number(behindMatch?.[1] ?? 0)
        continue
      }
      if (record.length < 4) continue
      const indexStatus = record.slice(0, 1)
      const worktree = record.slice(1, 2)
      const path = record.slice(3)
      const renamed = indexStatus === 'R' || indexStatus === 'C' || worktree === 'R' || worktree === 'C'
      const originalPath = renamed ? records[++index] : undefined
      files.push({ path, index: indexStatus, worktree, ...(originalPath === undefined ? {} : { originalPath }) })
    }
    return { ...(branch === undefined ? {} : { branch }), ahead, behind, files }
  }

  async gitFileDiff(workspacePath: string, path: string, basis: 'staged' | 'worktree', signal?: AbortSignal): Promise<WorkspaceGitDiff> {
    this.assertRelativePath(path)
    const status = await this.gitStatus(workspacePath, signal)
    const file = status.files.find(item => item.path === path)
    if (file === undefined) throw new WorkspaceInspectorError('file-not-found', 'file has no uncommitted Git change')
    if (basis === 'staged' && file.index === ' ') throw new WorkspaceInspectorError('file-not-found', 'file has no staged change')
    if (basis === 'worktree' && file.worktree === ' ') throw new WorkspaceInspectorError('file-not-found', 'file has no working-tree change')
    const oldObject = basis === 'staged' ? 'HEAD:' + path : (file.index !== ' ' ? ':' : 'HEAD:') + path
    const newObject = basis === 'staged' ? ':' + path : undefined
    const oldText = await this.gitObject(workspacePath, oldObject, signal)
    const newText = newObject === undefined
      ? await this.workingText(workspacePath, path, signal)
      : await this.gitObject(workspacePath, newObject, signal)
    return { path, basis, oldText, newText: newText ?? '' }
  }

  private async resolveDescendant(
    workspacePath: string, path: string, signal?: AbortSignal,
  ): Promise<{ root: FsTarget; target: FsTarget; path: string }> {
    this.assertRelativePath(path, true)
    let root: FsTarget
    try { root = await this.ctx.fs.resolve(workspacePath, signal === undefined ? {} : { signal }) } catch { throw new WorkspaceInspectorError('workspace-invalid', 'workspace root is unavailable') }
    const rootInfo = await this.ctx.fs.stat(root, signal)
    if (rootInfo === undefined || rootInfo.type !== 'directory') throw new WorkspaceInspectorError('workspace-invalid', 'workspace root is not a directory')
    const normalized = path.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '')
    const target = normalized === '' ? root : await this.ctx.fs.resolve(normalized, { cwd: this.ctx.fs.processPath(root), ...(signal === undefined ? {} : { signal }) })
    if (!this.ctx.fs.contains(root, target)) throw new WorkspaceInspectorError('path-outside-workspace', 'path resolves outside workspace root')
    return { root, target, path: normalized }
  }

  private assertRelativePath(path: string, allowEmpty = false): void {
    if ((!allowEmpty && path === '') || path.startsWith('/') || path.startsWith('\\') || path.split(/[\\/]/).some(part => part === '..')) throw new WorkspaceInspectorError('path-invalid', 'path must be a relative workspace descendant')
  }

  private relativeChild(root: FsTarget, entry: FsDirEntry): string {
    const path = relativePosix(relative(this.ctx.fs.processPath(root), this.ctx.fs.processPath(entry.target)))
    if (path === '' || path === '..' || path.startsWith('../')) throw new WorkspaceInspectorError('path-outside-workspace', 'directory entry resolves outside workspace root')
    return path
  }

  private async workingText(workspacePath: string, path: string, signal?: AbortSignal): Promise<string | null> {
    try { return (await this.readFilePreview(workspacePath, path, signal)).text } catch (error) {
      if (error instanceof WorkspaceInspectorError && error.code === 'file-not-found') return ''
      throw error
    }
  }

  private async gitObject(workspacePath: string, object: string, signal?: AbortSignal): Promise<string | null> {
    const result = await this.gitResult(workspacePath, ['show', '--no-ext-diff', '--no-textconv', '--format=', object], signal)
    if (result.exitCode !== 0) return null
    if (new TextEncoder().encode(result.stdout).byteLength > MAX_TEXT_BYTES) throw new WorkspaceInspectorError('file-too-large', 'Git text basis exceeds the preview limit')
    return result.stdout
  }

  private async git(workspacePath: string, args: readonly string[], signal?: AbortSignal): Promise<string> {
    const result = await this.gitResult(workspacePath, args, signal)
    if (result.exitCode === 0) return result.stdout
    if (/not a git repository/i.test(result.stderr)) throw new WorkspaceInspectorError('git-not-repository', result.stderr.trim() || 'workspace is not a Git repository')
    throw new WorkspaceInspectorError('git-failed', result.stderr.trim() || 'Git command failed')
  }

  private async gitResult(
    workspacePath: string, args: readonly string[], signal?: AbortSignal,
  ): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
    let root: FsTarget
    try { root = await this.ctx.fs.resolve(workspacePath, signal === undefined ? {} : { signal }) } catch { throw new WorkspaceInspectorError('workspace-invalid', 'workspace root is unavailable') }
    let executable: string
    try { executable = await this.ctx.subprocess.resolveExecutable('git', { GIT_OPTIONAL_LOCKS: '0' }, signal) } catch { throw new WorkspaceInspectorError('git-unavailable', 'Git is not available') }
    const handle = this.ctx.subprocess.spawn({
      argv: [executable, '-c', 'core.quotepath=false', '-c', 'diff.external=', '-c', 'core.attributesfile=', ...args],
      cwd: this.ctx.fs.processPath(root),
      stdio: { stdin: 'ignore', stdout: { maxBytes: MAX_GIT_OUTPUT_BYTES }, stderr: { maxBytes: MAX_GIT_OUTPUT_BYTES } },
      graceMs: 1000, signal,
      env: { GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: 'cat', PAGER: 'cat', GIT_TERMINAL_PROMPT: '0' },
    })
    const outcome = await handle.done
    return { exitCode: outcome.exitCode, stdout: this.output(handle.collected.stdout), stderr: this.output(handle.collected.stderr) }
  }

  private output(reader: SubprocessOutputReader | undefined): string {
    if (reader === undefined) throw new WorkspaceInspectorError('git-failed', 'Git output collection is unavailable')
    const result = reader.readFrom(0)
    if (result.lossy) throw new WorkspaceInspectorError('git-failed', 'Git output exceeded the configured limit')
    return result.text
  }
}

export default WorkspaceInspector
