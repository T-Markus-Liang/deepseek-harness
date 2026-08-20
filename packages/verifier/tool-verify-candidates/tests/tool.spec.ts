import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { CallId, createMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { SESSION_FORMAT_VERSION, Session, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionEvent, SessionHeader, SessionId as SessionIdType } from '@deepseek-ai/dsh-session'
import SessionPersistence, { SessionPersistenceRevision } from '@deepseek-ai/dsh-session-persistence'
import { Verifier } from '@deepseek-ai/dsh-verifier'
import type { VerifierSelectRequest, VerifierSelection } from '@deepseek-ai/dsh-verifier'
import * as toolPlugin from '../src/index.ts'

function header(id: string, cwd = '/work'): SessionHeader {
  return { version: SESSION_FORMAT_VERSION, id: SessionId(id), createdAt: 1, cwd }
}

class TestPersistence extends SessionPersistence {
  override readonly supportsRawArtifacts = false
  readonly entries = new Map<SessionIdType, { meta: SessionHeader; events: SessionEvent[] }>()
  locate(): undefined { return undefined }
  create(meta: SessionHeader): Promise<void> { this.entries.set(meta.id, { meta, events: [] }); return Promise.resolve() }
  append(id: SessionIdType, events: readonly SessionEvent[]): Promise<void> {
    this.entries.get(id)?.events.push(...structuredClone(events)); return Promise.resolve()
  }
  load(id: SessionIdType) { return this.inspect(id) }
  inspect(id: SessionIdType, signal?: AbortSignal): Promise<{ meta: SessionHeader; events: SessionEvent[] }> {
    signal?.throwIfAborted()
    const entry = this.entries.get(id)
    return entry === undefined ? Promise.reject(new Error(`missing ${String(id)}`)) : Promise.resolve(structuredClone(entry))
  }
  async readFrom(id: SessionIdType, fromSeq: number, signal?: AbortSignal) {
    const entry = await this.inspect(id, signal)
    return { meta: entry.meta, events: entry.events.filter(event => event.seq >= fromSeq) }
  }
  override remove(id: SessionIdType): Promise<void> { this.entries.delete(id); return Promise.resolve() }
  override move(): Promise<void> { return Promise.resolve() }
  list(): Promise<SessionHeader[]> { return Promise.resolve([...this.entries.values()].map(item => item.meta)) }
  listSnapshots(): Promise<Array<{ header: SessionHeader; revision: SessionPersistenceRevision }>> {
    return Promise.resolve([...this.entries.values()].map(item => ({
      header: item.meta,
      revision: SessionPersistenceRevision(`events:${item.events.length}`),
    })))
  }
}

class RecordingVerifier extends Verifier {
  request: VerifierSelectRequest | undefined
  override select(request: VerifierSelectRequest): Promise<VerifierSelection> {
    this.request = request
    return Promise.resolve({
      index: 1,
      scores: [0.2, 0.8],
      ranking: [1, 0],
      comparisons: 2,
      criteria: ['correctness'],
      usage: { calls: 2, inputTokens: 10, cachedInputTokens: 2, uncachedInputTokens: 8, outputTokens: 4, reasoningTokens: 1 },
    })
  }
}

function events(id: string, answer: string): SessionEvent[] {
  const session = Session.create(SessionId(id))
  session.append('turn/start', { turn: 1 })
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: 'Fix the test' }], source: { kind: 'user' },
  }), { surfaceOp: 'append' })
  session.append('assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: 'not a surface message' } })
  session.append('assistant/message', {
    turn: 1,
    step: 1,
    message: createMessage({
      role: 'assistant',
      content: [{ type: 'text', text: answer }],
      source: { kind: 'model', provider: 'test', model: 'test' },
    }),
  }, { surfaceOp: 'append' })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  return [...session.events]
}

async function setup(): Promise<{ ctx: Context; persistence: TestPersistence; verifier: RecordingVerifier }> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  const persistence = new TestPersistence(ctx)
  const verifier = new RecordingVerifier(ctx)
  await ctx.plugin(toolPlugin, {
    model: 'verifier-model',
    nEvaluations: 3,
    pivots: 2,
    maxConcurrency: 2,
    maxCandidates: 4,
    maxTrajectoryChars: 10_000,
  })
  return { ctx, persistence, verifier }
}

function caller(ctx: Context): Agent {
  const id = SessionId('caller')
  const session = Session.create(id, undefined, header(id))
  return { id, session, ctx } as unknown as Agent
}

describe('verify_candidates tool', () => {
  it('projects current Session surfaces and maps verifier ranking back to Session ids', async () => {
    const { ctx, persistence, verifier } = await setup()
    persistence.entries.set(SessionId('candidate-a'), { meta: header('candidate-a'), events: events('candidate-a', 'wrong answer') })
    persistence.entries.set(SessionId('candidate-b'), { meta: header('candidate-b'), events: events('candidate-b', 'fixed and tested') })

    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('verify-1'),
      name: 'verify_candidates',
      agent: caller(ctx),
      arguments: {
        problem: 'Fix the failing test',
        candidateSessionIds: ['candidate-a', 'candidate-b'],
        criteria: [{ name: 'Correctness', description: 'Did the change fix the failure?' }],
        seed: 9,
      },
    })

    expect(result.isError).toBe(false)
    expect(result.value).toEqual({
      winnerSessionId: 'candidate-b',
      rankingSessionIds: ['candidate-b', 'candidate-a'],
      scores: [0.2, 0.8],
      comparisons: 2,
      usage: { calls: 2, inputTokens: 10, cachedInputTokens: 2, uncachedInputTokens: 8, outputTokens: 4, reasoningTokens: 1 },
    })
    expect(verifier.request).toMatchObject({ model: 'verifier-model', nEvaluations: 3, pivots: 2, seed: 9, maxConcurrency: 2 })
    expect(JSON.parse(verifier.request!.candidates[0]!)).toMatchObject([
      { role: 'user' },
      { role: 'assistant', content: [{ type: 'text', text: 'wrong answer' }] },
    ])
    expect(verifier.request!.candidates[0]).not.toContain('not a surface message')
  })

  it('rejects duplicate ids and oversized projected trajectories before verifier dispatch', async () => {
    const { ctx, persistence, verifier } = await setup()
    persistence.entries.set(SessionId('candidate-a'), { meta: header('candidate-a'), events: events('candidate-a', 'answer') })
    const duplicate = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('verify-duplicate'),
      name: 'verify_candidates',
      agent: caller(ctx),
      arguments: {
        problem: 'task',
        candidateSessionIds: ['candidate-a', 'candidate-a'],
        criteria: [{ name: 'Quality', description: 'Is it good?' }],
      },
    })
    expect(duplicate.isError).toBe(true)
    expect(verifier.request).toBeUndefined()

    expect(() => toolPlugin.projectCandidateTrajectory('candidate-a', events('candidate-a', 'long answer'), 3))
      .toThrow(/exceeds maxTrajectoryChars/)
  })

  it('requires an agent caller and rejects cross-workspace candidates before verifier dispatch', async () => {
    const { ctx, persistence, verifier } = await setup()
    persistence.entries.set(SessionId('outside'), { meta: header('outside', '/outside'), events: events('outside', 'secret') })

    const missingCaller = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('verify-missing-caller'),
      name: 'verify_candidates',
      arguments: {
        problem: 'task',
        candidateSessionIds: ['outside'],
        criteria: [{ name: 'Quality', description: 'Is it good?' }],
      },
    })
    expect(missingCaller.isError).toBe(true)

    const outside = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('verify-outside'),
      name: 'verify_candidates',
      agent: caller(ctx),
      arguments: {
        problem: 'task',
        candidateSessionIds: ['outside'],
        criteria: [{ name: 'Quality', description: 'Is it good?' }],
      },
    })
    expect(outside.isError).toBe(true)
    expect(JSON.stringify(outside)).not.toContain('secret')
    expect(verifier.request).toBeUndefined()
  })
})
