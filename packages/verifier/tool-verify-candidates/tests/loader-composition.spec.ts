import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { CallId, createMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SESSION_FORMAT_VERSION, Session, SessionId } from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { Verifier } from '@deepseek-ai/dsh-verifier'
import type { VerifierSelectRequest, VerifierSelection } from '@deepseek-ai/dsh-verifier'
import * as ToolVerifyCandidates from '../src/index.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

class FixedVerifier extends Verifier {
  override select(request: VerifierSelectRequest): Promise<VerifierSelection> {
    return Promise.resolve({
      index: request.candidates.length - 1,
      ranking: request.candidates.map((_, index) => index).reverse(),
      scores: request.candidates.map((_, index) => index),
      comparisons: request.candidates.length,
      criteria: request.criteria.map(item => item.name.toLowerCase()),
      usage: {
        calls: 1,
        inputTokens: 4,
        cachedInputTokens: 0,
        uncachedInputTokens: 4,
        outputTokens: 1,
        reasoningTokens: 0,
      },
    })
  }
}

function fixedVerifier(ctx: Context): void {
  new FixedVerifier(ctx)
}

async function boot(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-verify-candidates-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-session'",
    "- name: '@deepseek-ai/dsh-session-persistence-jsonl'",
    '  config:',
    `    root: ${JSON.stringify(join(root, 'sessions'))}`,
    '    compression: none',
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: 'test-fixed-verifier'",
    "- name: '@deepseek-ai/dsh-tool-verify-candidates'",
    '  config:',
    '    model: loader-verifier',
    '    nEvaluations: 2',
    '    maxConcurrency: 1',
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-session', SessionStore],
    ['@deepseek-ai/dsh-session-persistence-jsonl', JsonlSessionPersistence],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['test-fixed-verifier', fixedVerifier],
    ['@deepseek-ai/dsh-tool-verify-candidates', ToolVerifyCandidates],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  return ctx
}

async function persistCandidate(ctx: Context, idValue: string, cwd: string, answer: string): Promise<void> {
  const id = SessionId(idValue)
  const session = Session.create(id, undefined, {
    version: SESSION_FORMAT_VERSION,
    id,
    createdAt: 1,
    cwd,
  })
  session.append('turn/start', { turn: 1 })
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: 'Solve the task.' }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
  session.append('assistant/message', {
    turn: 1,
    step: 1,
    message: createMessage({
      role: 'assistant',
      content: [{ type: 'text', text: answer }],
      source: { kind: 'model', provider: 'fixture', model: 'fixture' },
    }),
  }, { surfaceOp: 'append' })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  await ctx.sessionPersistence.create(session.header)
  await ctx.sessionPersistence.append(id, session.events)
}

describe('verify_candidates real Loader composition', () => {
  it('loads from cordis.yml and ranks durable Session ids through the configured verifier', async () => {
    const ctx = await boot()
    await persistCandidate(ctx, 'loader-candidate-a', root!, 'candidate A')
    await persistCandidate(ctx, 'loader-candidate-b', root!, 'candidate B')
    const callerId = SessionId('loader-caller')
    const callerSession = Session.create(callerId, undefined, {
      version: SESSION_FORMAT_VERSION,
      id: callerId,
      createdAt: 1,
      cwd: root!,
    })
    const caller = { id: callerId, session: callerSession, ctx } as unknown as Agent

    const result = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: CallId('loader-verify'),
      name: 'verify_candidates',
      agent: caller,
      arguments: {
        problem: 'Solve the task',
        candidateSessionIds: ['loader-candidate-a', 'loader-candidate-b'],
        criteria: [{ name: 'Correctness', description: 'Choose the correct result.' }],
      },
    })

    expect(result.isError).toBe(false)
    expect(result.value).toMatchObject({
      winnerSessionId: 'loader-candidate-b',
      rankingSessionIds: ['loader-candidate-b', 'loader-candidate-a'],
    })
    expect([...ctx.loader.entries()].filter(entry => entry.fiber === undefined && !entry.disabled)).toEqual([])
  }, 30_000)
})
