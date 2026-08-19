import { readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { normalizeSessionLog, scrubRequestHeaders, type NormalizeContext } from '@deepseek-ai/dsh-acp-snapshot'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@deepseek-ai/dsh-loader-smoke'
import { createMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SESSION_FORMAT_VERSION, Session, SessionId } from '@deepseek-ai/dsh-session'
import JsonlSessionPersistence from '@deepseek-ai/dsh-session-persistence-jsonl'
import { describe, expect, it } from 'vitest'

const candidateA = SessionId('51111111-1111-4111-8111-111111111111')
const candidateB = SessionId('52222222-2222-4222-8222-222222222222')
const fixtureDir = fileURLToPath(new URL('./snapshots/verifier-ranking', import.meta.url))
const replayOverride = join(fixtureDir, 'replay.override.json')
const parentExpected = join(fixtureDir, 'parent.expected.jsonl')
const configPath = fileURLToPath(new URL('../verifier.cordis.snapshot.yml', import.meta.url))
const binScript = fileURLToPath(new URL('./fixtures/headless-driver.ts', import.meta.url))
const tsconfigPath = fileURLToPath(new URL('../../../tsconfig.json', import.meta.url))
const refreshing = process.env.DSH_SNAPSHOT === 'refresh'
const task = 'Rank the two durable candidate Sessions, then report the winning Session id.'

function candidateSession(id: ReturnType<typeof SessionId>, cwd: string, answer: string): Session {
  const session = Session.create(id, undefined, {
    version: SESSION_FORMAT_VERSION,
    id,
    createdAt: 1,
    cwd,
  })
  session.append('turn/start', { turn: 1 })
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text: 'Implement the candidate task.' }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
  session.append('assistant/message', {
    turn: 1,
    step: 1,
    message: createMessage({
      role: 'assistant',
      content: [{ type: 'text', text: answer }],
      source: { kind: 'model', provider: 'snapshot', model: 'candidate' },
    }),
  }, { surfaceOp: 'append' })
  session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
  return session
}

async function seedCandidates(root: string, cwd: string): Promise<void> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(JsonlSessionPersistence, { root, compression: 'none' })
  try {
    for (const session of [
      candidateSession(candidateA, cwd, 'candidate A is incomplete'),
      candidateSession(candidateB, cwd, 'candidate B is complete and tested'),
    ]) {
      await ctx.sessionPersistence.create(session.header)
      await ctx.sessionPersistence.append(session.id, session.events)
    }
  } finally {
    await ctx.fiber.dispose()
  }
}

function records(content: string): Record<string, unknown>[] {
  return content.trimEnd().split('\n').map(line => JSON.parse(line) as Record<string, unknown>)
}

describe('assembled verifier tools snapshot', () => {
  it('ranks durable Sessions with a keyless verifier and exposes the isolated workflow schema', async () => {
    const result = await runLoaderSmoke({
      label: 'verifier ranking headless stream-json snapshot',
      tempDirPrefix: 'dsh-verifier-snapshot-',
      binScript,
      libBinScript: binScript,
      configPath,
      binArgs: [configPath, task],
      tsconfigPath,
      env: {
        DSH_SNAPSHOT: 'replay',
        DSH_SNAPSHOT_FILE: join(fixtureDir, 'session.jsonl'),
        DSH_SNAPSHOT_OVERRIDE: replayOverride,
        NODE_OPTIONS: [process.env.NODE_OPTIONS, '--disable-warning=ExperimentalWarning'].filter(Boolean).join(' '),
      },
      prepare: async (cwd) => {
        await seedCandidates(join(cwd, '.sessions'), await realpath(cwd))
      },
      inspect: async (cwd) => {
        const parentPath = await findParentLog(cwd)
        const parent = await readFile(parentPath, 'utf8')
        const parentId = records(parent)[0]?.id
        if (typeof parentId !== 'string') throw new Error('verifier snapshot emitted no parent result')
        const header = records(parent).find(line => line.type === 'request/header')
        const tools = ((header?.data as Record<string, unknown> | undefined)?.header as Record<string, unknown> | undefined)?.tools
        expect(JSON.stringify(tools)).toContain('verify_candidates')
        expect(JSON.stringify(tools)).toContain('best_of_n')
        expect(parent).toContain(String(candidateB))
        expect(parent).toContain('winnerSessionId')

        const context: NormalizeContext = { sessionIds: [parentId, candidateA, candidateB], cwd }
        const normalized = scrubRequestHeaders(normalizeSessionLog(parent, context))
        if (refreshing) await writeFile(parentExpected, normalized)
        expect(normalized).toBe(await readFile(parentExpected, 'utf8'))
      },
    })

    expect(result.stderr).toBe('')
    expect(resultLogs(result.stdout).at(-1)).toMatchObject({
      type: 'result',
      output: `The winning Session is ${String(candidateB)}.`,
    })
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})

function resultLogs(stdout: string): Record<string, unknown>[] {
  return stdout.trimEnd().split('\n').map(line => JSON.parse(line) as Record<string, unknown>)
}

async function findParentLog(cwd: string): Promise<string> {
  const root = join(cwd, '.sessions')
  const files = (await readdir(root, { recursive: true })).filter(file => file.endsWith('.jsonl'))
  for (const file of files) {
    const path = join(root, file)
    const first = (await readFile(path, 'utf8')).split('\n', 1)[0]
    if (first !== undefined && !first.includes(String(candidateA)) && !first.includes(String(candidateB))) return path
  }
  throw new Error('verifier snapshot did not persist its parent Session')
}
