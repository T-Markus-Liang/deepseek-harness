import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { CallId, createMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import { SESSION_FORMAT_VERSION, Session, SessionId } from '@deepseek-ai/dsh-session'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import type { ResolvedSubagentStartRequest, SubagentProvider, SubagentRun } from '@deepseek-ai/dsh-subagent'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { Verifier } from '@deepseek-ai/dsh-verifier'
import type { VerifierSelectRequest, VerifierSelection } from '@deepseek-ai/dsh-verifier'
import * as toolPlugin from '../src/index.ts'

const roots: string[] = []
const contexts: Context[] = []

afterEach(async () => {
  await Promise.allSettled(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' })
}

async function repository(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-best-of-n-test-'))
  roots.push(root)
  git(root, 'init', '-q')
  git(root, 'config', 'user.email', 'test@example.invalid')
  git(root, 'config', 'user.name', 'Test')
  await writeFile(join(root, 'base.txt'), 'base\n')
  git(root, 'add', 'base.txt')
  git(root, 'commit', '-qm', 'base')
  return root
}

function candidateSession(id: string, cwd: string, answer: string): Session {
  const session = Session.create(SessionId(id), undefined, {
    version: SESSION_FORMAT_VERSION,
    id: SessionId(id),
    createdAt: 1,
    cwd,
    origin: 'subagent',
  })
  session.append('turn/start', { turn: 1 })
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: 'candidate task' }], source: { kind: 'user' },
  }), { surfaceOp: 'append' })
  session.append('assistant/message', {
    turn: 1,
    step: 1,
    message: createMessage({
      role: 'assistant',
      content: [{ type: 'text', text: answer }],
      source: { kind: 'model', provider: 'fake', model: 'fake' },
    }),
  }, { surfaceOp: 'append' })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  return session
}

class CandidateProvider implements SubagentProvider {
  readonly name = 'isolated'
  readonly capabilities = { outputSchema: false, depthLimit: false, toolFilter: false, persona: false, workspaceCwd: true }
  readonly inheritsParentContext = false
  readonly paths: string[] = []
  disposed = 0
  failDispose = false

  async start(request: ResolvedSubagentStartRequest): Promise<SubagentRun> {
    const cwd = request.workspaceCwd!
    const index = this.paths.push(cwd)
    await writeFile(join(cwd, 'solution.txt'), `candidate ${index}\n`)
    const id = SessionId(`candidate-${index}`)
    const session = candidateSession(id, cwd, `implemented candidate ${index}`)
    const localAgent = { id, session, ctx: request.parent.ctx } as unknown as Agent
    return {
      id,
      localAgent,
      result: Promise.resolve({ output: [], stopReason: 'completed' }),
      dispose: () => {
        this.disposed += 1
        return this.failDispose ? Promise.reject(new Error('candidate dispose failed')) : Promise.resolve()
      },
    }
  }
}

class ChoosingVerifier extends Verifier {
  request: VerifierSelectRequest | undefined
  beforeReturn: (() => Promise<void>) | undefined
  override async select(request: VerifierSelectRequest): Promise<VerifierSelection> {
    this.request = request
    await this.beforeReturn?.()
    return {
      index: 1,
      ranking: [1, 0],
      scores: [0.1, 0.9],
      comparisons: 2,
      criteria: ['correctness'],
      usage: { calls: 2, inputTokens: 10, cachedInputTokens: 0, uncachedInputTokens: 10, outputTokens: 2, reasoningTokens: 0 },
    }
  }
}

async function setup(root: string): Promise<{ ctx: Context; parent: Agent; provider: CandidateProvider; verifier: ChoosingVerifier }> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(LocalSubprocessRuntime)
  await ctx.plugin(SubagentRuntime)
  const provider = new CandidateProvider()
  ctx.subagents.registerProvider(provider)
  const verifier = new ChoosingVerifier(ctx)
  await ctx.plugin(toolPlugin, {
    subagentProvider: 'isolated',
    verifierModel: 'verifier-model',
    nEvaluations: 2,
    pivots: 1,
    maxConcurrency: 2,
    maxCandidates: 3,
    maxGitOutputBytes: 1024 * 1024,
    gitGraceMs: 100,
  })
  const id = SessionId('parent')
  const session = Session.create(id, undefined, { version: SESSION_FORMAT_VERSION, id, createdAt: 1, cwd: root })
  const parent = { id, session, ctx } as unknown as Agent
  return { ctx, parent, provider, verifier }
}

describe('best_of_n isolated workflow', () => {
  it('runs candidates in detached worktrees, promotes only the winner, and removes every worktree', async () => {
    const root = await repository()
    const { ctx, parent, provider, verifier } = await setup(root)
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('best-1'),
      name: 'best_of_n',
      agent: parent,
      arguments: {
        objective: 'Create solution.txt',
        candidates: 2,
        criteria: [{ name: 'Correctness', description: 'Choose the stronger implementation.' }],
      },
    })

    expect(result.isError).toBe(false)
    expect(result.value).toMatchObject({
      winnerSessionId: 'candidate-2',
      candidateSessionIds: ['candidate-1', 'candidate-2'],
      rankingSessionIds: ['candidate-2', 'candidate-1'],
      promoted: true,
    })
    expect(await readFile(join(root, 'solution.txt'), 'utf8')).toBe('candidate 2\n')
    expect(git(root, 'status', '--porcelain=v1')).toBe('?? solution.txt\n')
    expect(git(root, 'worktree', 'list', '--porcelain').match(/^worktree /gm)).toHaveLength(1)
    expect(provider.disposed).toBe(2)
    expect(provider.paths.every(path => !existsSync(path))).toBe(true)
    expect(verifier.request).toMatchObject({ model: 'verifier-model', nEvaluations: 2, maxConcurrency: 2 })
    expect(verifier.request!.candidates[1]).toContain('implemented candidate 2')
  })

  it('rejects a dirty parent before creating candidate worktrees', async () => {
    const root = await repository()
    await writeFile(join(root, 'dirty.txt'), 'dirty\n')
    const { ctx, parent, provider } = await setup(root)
    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('best-dirty'),
      name: 'best_of_n',
      agent: parent,
      arguments: {
        objective: 'Do work',
        candidates: 2,
        criteria: [{ name: 'Quality', description: 'Choose quality.' }],
      },
    })
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({ type: 'text', text: expect.stringContaining('requires a clean parent Git worktree') as string })
    expect(provider.paths).toEqual([])
  })

  it('preserves the winner recovery path when promotion and cleanup both fail', async () => {
    const root = await repository()
    const { ctx, parent, provider, verifier } = await setup(root)
    provider.failDispose = true
    verifier.beforeReturn = () => writeFile(join(root, 'concurrent.txt'), 'changed\n')

    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('best-recovery'),
      name: 'best_of_n',
      agent: parent,
      arguments: {
        objective: 'Create solution.txt',
        candidates: 2,
        criteria: [{ name: 'Correctness', description: 'Choose the stronger implementation.' }],
      },
    })

    expect(result.isError).toBe(true)
    const text = JSON.stringify(result)
    expect(text).toContain('parent Git worktree changed while best_of_n candidates were running')
    expect(text).toContain('winning worktree preserved at')
    expect(text).toContain('cleanup also failed: candidate dispose failed')
    const preserved = provider.paths[1]!
    expect(existsSync(preserved)).toBe(true)
    roots.push(dirname(preserved))
  })
})
