// Covers the Git status path: complete parses, lossy-tail tolerance, strict
// text paths, and exit-code error mapping, all against scripted subprocesses.

import { describe, expect, it } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import type { FsTarget } from '@deepseek-ai/dsh-fs'
import type { SubprocessHandle, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import WorkspaceInspector, { WorkspaceInspectorError } from '../src/index.ts'

interface ScriptEntry { exitCode: number; stdout: string; stdoutLossy: boolean; stderr: string }
interface FakeSubprocess { calls: string[][]; service: new (ctx: Context) => Service }

/** Script one Git response per spawn, keyed by an argv substring. */
function fakeSubprocess(entries: { match: string; response: ScriptEntry }[]): FakeSubprocess {
  const calls: string[][] = []
  return {
    calls,
    service: class extends Service {
      static inject: string[] = []
      constructor(ctx: Context) { super(ctx, 'subprocess') }
      resolveExecutable = async (name: string): Promise<string> => '/usr/bin/' + name
      spawn = (spec: SubprocessSpawnSpec): SubprocessHandle => {
        const argv = spec.argv
        calls.push([...argv])
        const entry = entries.find(candidate => argv.some(arg => arg.includes(candidate.match)))
        const response: ScriptEntry = entry === undefined
          ? { exitCode: 1, stdout: '', stdoutLossy: false, stderr: 'unscripted invocation' }
          : entry.response
        return {
          pid: 1,
          stdin: undefined,
          stdout: undefined,
          stderr: undefined,
          collected: {
            stdout: { readFrom: () => ({ text: response.stdout, nextOffset: response.stdout.length, lossy: response.stdoutLossy }) },
            stderr: { readFrom: () => ({ text: response.stderr, nextOffset: response.stderr.length, lossy: false }) },
          },
          done: Promise.resolve({ exitCode: response.exitCode, signal: null }),
          terminate: () => {},
          waitForExit: async () => true,
        }
      }
    },
  }
}

/** Minimal fs face: gitResult only resolves the root and reads its process path. */
class FakeFs extends Service {
  static inject: string[] = []
  constructor(ctx: Context) { super(ctx, 'fs') }
  resolve = async (path: string): Promise<FsTarget> => ({ path } as unknown as FsTarget)
  processPath = (target: FsTarget): string => (target as unknown as { path: string }).path
}

async function boot(subprocess: FakeSubprocess): Promise<WorkspaceInspector> {
  const ctx = new Context()
  await ctx.plugin(FakeFs)
  await ctx.plugin(subprocess.service)
  await ctx.plugin(WorkspaceInspector)
  return ctx.workspaceInspector
}

describe('WorkspaceInspector.gitStatus', () => {
  it('parses a complete porcelain stream with branch, counts, and a rename pair', async () => {
    const stdout = '## main...origin/main [ahead 2, behind 1]\0 M src/a.ts\0M  src/b.ts\0?? src/c.ts\0R  src/new.ts\0src/old.ts\0'
    const fake = fakeSubprocess([{ match: 'status', response: { exitCode: 0, stdout, stdoutLossy: false, stderr: '' } }])
    const inspector = await boot(fake)
    const status = await inspector.gitStatus('/workspace')
    expect(status).toEqual({
      branch: 'main',
      ahead: 2,
      behind: 1,
      files: [
        { path: 'src/a.ts', index: ' ', worktree: 'M' },
        { path: 'src/b.ts', index: 'M', worktree: ' ' },
        { path: 'src/c.ts', index: '?', worktree: '?' },
        { path: 'src/new.ts', index: 'R', worktree: ' ', originalPath: 'src/old.ts' },
      ],
      truncated: false,
    })
  })

  it('drops the partial head record and orphaned rename source of a lossy tail', async () => {
    // The retained tail starts mid-record ("rc/a.ts" is the cut remainder of
    // " M src/a.ts"); "src/old.ts" is a rename source whose record was lost.
    const stdout = 'rc/a.ts\0src/old.ts\0M  src/b.ts\0?? src/c.ts\0'
    const fake = fakeSubprocess([{ match: 'status', response: { exitCode: 0, stdout, stdoutLossy: true, stderr: '' } }])
    const inspector = await boot(fake)
    const status = await inspector.gitStatus('/workspace')
    expect(status).toEqual({
      ahead: 0,
      behind: 0,
      files: [
        { path: 'src/b.ts', index: 'M', worktree: ' ' },
        { path: 'src/c.ts', index: '?', worktree: '?' },
      ],
      truncated: true,
    })
  })

  it('maps a non-repository exit to git-not-repository', async () => {
    const fake = fakeSubprocess([{ match: 'status', response: { exitCode: 128, stdout: '', stdoutLossy: false, stderr: 'fatal: not a git repository' } }])
    const inspector = await boot(fake)
    const failure = await inspector.gitStatus('/workspace').catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(WorkspaceInspectorError)
    expect((failure as WorkspaceInspectorError).code).toBe('git-not-repository')
  })
})

describe('WorkspaceInspector.gitFileDiff', () => {
  it('keeps text bases strict: lossy show output fails instead of corrupting the diff', async () => {
    const stdout = '## main\0M  src/b.ts\0'
    const fake = fakeSubprocess([
      { match: 'status', response: { exitCode: 0, stdout, stdoutLossy: false, stderr: '' } },
      { match: 'HEAD:src/b.ts', response: { exitCode: 0, stdout: 'old text', stdoutLossy: false, stderr: '' } },
      { match: ':src/b.ts', response: { exitCode: 0, stdout: 'new te', stdoutLossy: true, stderr: '' } },
    ])
    const inspector = await boot(fake)
    const failure = await inspector.gitFileDiff('/workspace', 'src/b.ts', 'staged').catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(WorkspaceInspectorError)
    expect((failure as WorkspaceInspectorError).code).toBe('git-failed')
  })
})
