import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { CredentialProvider, credentialRef } from '@deepseek-ai/dsh-credentials'
import type { CredentialInfo, CredentialRef, ResolvedCredential } from '@deepseek-ai/dsh-credentials'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import type { VerifierSelectRequest } from '@deepseek-ai/dsh-verifier'
import * as providerPlugin from '../src/index.ts'
import { LLM_VERIFIER_REQUIREMENT, PYTHON_BRIDGE } from '../src/bridge.ts'

class TestCredentials extends CredentialProvider {
  constructor(ctx: Context, private readonly values: Readonly<Record<string, string>>) { super(ctx) }
  override resolve(ref: CredentialRef): Promise<ResolvedCredential | undefined> {
    const value = this.values[ref]
    return Promise.resolve(value === undefined ? undefined : { value, source: 'test' })
  }
  override describe(ref: CredentialRef): Promise<CredentialInfo> {
    return Promise.resolve({ configured: this.values[ref] !== undefined, source: 'test', writable: false })
  }
  override set(): Promise<void> { return Promise.reject(new Error('read-only test credentials')) }
  override unset(): Promise<void> { return Promise.reject(new Error('read-only test credentials')) }
}

const roots: string[] = []
const contexts: Context[] = []

afterEach(async () => {
  delete process.env['SHOULD_NOT_LEAK_SECRET']
  await Promise.allSettled(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function fixture(source: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-verifier-fake-'))
  roots.push(root)
  const path = join(root, 'bridge.mjs')
  await writeFile(path, source)
  return path
}

function request(overrides: Partial<VerifierSelectRequest> = {}): VerifierSelectRequest {
  return {
    problem: 'Fix the failing test.',
    candidates: ['candidate A', 'candidate B'],
    criteria: [{ name: 'Correctness', description: 'Does the trajectory solve the task?' }],
    model: 'deepseek-chat',
    nEvaluations: 2,
    pivots: 1,
    seed: 7,
    maxConcurrency: 3,
    ...overrides,
  }
}

async function setup(bridgePath: string, values: Record<string, string> = { TEST_VERIFIER_KEY: 'explicit-secret' }, extra: providerPlugin.Config = {}): Promise<Context> {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(LocalSubprocessRuntime)
  new TestCredentials(ctx, values)
  const config: providerPlugin.Config = {
    pythonCommand: process.execPath,
    bridgePath,
    credentialRef: 'TEST_VERIFIER_KEY',
    credentialEnv: 'TEST_VERIFIER_KEY',
  }
  Object.assign(config, extra)
  await ctx.plugin(providerPlugin, config)
  return ctx
}

function successResult(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    protocolVersion: 1,
    packageVersion: '0.2.0',
    ok: true,
    result: {
      index: 1,
      scores: [0.25, 0.75],
      ranking: [1, 0],
      comparisons: 2,
      criteria: ['correctness'],
      usage: {
        calls: 2,
        inputTokens: 100,
        cachedInputTokens: 20,
        uncachedInputTokens: 80,
        outputTokens: 10,
        reasoningTokens: 4,
      },
      ...overrides,
    },
  })
}

describe('Python verifier JSON bridge', () => {
  it('sends an explicit select request from a private cwd and forwards only the configured credential', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-verifier-capture-'))
    roots.push(root)
    const capture = join(root, 'capture.json')
    process.env['SHOULD_NOT_LEAK_SECRET'] = 'ambient-secret'
    const bridge = await fixture(`
      import fs from 'node:fs';
      const request = JSON.parse(fs.readFileSync(0, 'utf8'));
      fs.writeFileSync(${JSON.stringify(capture)}, JSON.stringify({
        request,
        cwd: process.cwd(),
        credential: process.env.TEST_VERIFIER_KEY,
        leaked: process.env.SHOULD_NOT_LEAK_SECRET,
      }));
      process.stdout.write(${JSON.stringify(successResult())});
    `)
    const ctx = await setup(bridge)

    const selected = await ctx.verifier.select(request())
    const captured = JSON.parse(await readFile(capture, 'utf8')) as {
      request: Record<string, unknown>
      cwd: string
      credential?: string
      leaked?: string
    }

    expect(selected).toEqual({
      index: 1,
      scores: [0.25, 0.75],
      ranking: [1, 0],
      comparisons: 2,
      criteria: ['correctness'],
      usage: { calls: 2, inputTokens: 100, cachedInputTokens: 20, uncachedInputTokens: 80, outputTokens: 10, reasoningTokens: 4 },
    })
    expect(captured.request).toMatchObject({ protocolVersion: 1, problem: 'Fix the failing test.', nEvaluations: 2, maxConcurrency: 3 })
    expect(captured.cwd).toContain('dsh-verifier-')
    expect(captured.credential).toBe('explicit-secret')
    expect(captured.leaked).toBeUndefined()
  })

  it('does not require a credential for the upstream single-candidate fast path', async () => {
    const one = JSON.stringify({
      protocolVersion: 1,
      packageVersion: '0.2.0',
      ok: true,
      result: {
        index: 0, scores: [1], ranking: [0], comparisons: 0, criteria: ['correctness'],
        usage: { calls: 0, inputTokens: 0, cachedInputTokens: 0, uncachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0 },
      },
    })
    const bridge = await fixture(`process.stdout.write(${JSON.stringify(one)})`)
    const ctx = await setup(bridge, {})
    await expect(ctx.verifier.select(request({ candidates: ['only'] }))).resolves.toMatchObject({ index: 0, comparisons: 0 })
  })

  it('waits for a cancelled bridge process to exit before rejecting', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-verifier-cancel-'))
    roots.push(root)
    const pidFile = join(root, 'pid')
    const bridge = await fixture(`
      import fs from 'node:fs';
      fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));
      setInterval(() => {}, 1000);
    `)
    const ctx = await setup(bridge, undefined, { graceMs: 20 })
    const abort = new AbortController()
    const pending = ctx.verifier.select(request({ signal: abort.signal }))
    while (true) {
      try { await readFile(pidFile); break } catch { await new Promise(resolve => setTimeout(resolve, 5)) }
    }
    abort.abort(new Error('test cancellation'))
    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' })
    const pid = Number(await readFile(pidFile, 'utf8'))
    expect(() => process.kill(pid, 0)).toThrow()
  })

  it('injects DeepSeek-compatible environment into the bridge when configured', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-verifier-deepseek-'))
    roots.push(root)
    const capture = join(root, 'capture.json')
    const bridge = await fixture(`
      import fs from 'node:fs';
      const request = JSON.parse(fs.readFileSync(0, 'utf8'));
      fs.writeFileSync(${JSON.stringify(capture)}, JSON.stringify({
        compatible: process.env.LLM_VERIFIER_DEEPSEEK_COMPATIBLE,
        maxTokens: process.env.DEEPSEEK_MAX_TOKENS,
        effort: process.env.DEEPSEEK_EFFORT,
        baseUrl: process.env.OPENAI_BASE_URL,
        credential: process.env.OPENAI_API_KEY,
        payloadModel: request.model,
      }));
      process.stdout.write(${JSON.stringify(successResult())});
    `)
    const ctx = await setup(
      bridge,
      { TEST_VERIFIER_KEY: 'explicit-secret' },
      { credentialEnv: 'OPENAI_API_KEY', deepseekCompatible: true, maxTokens: 4096, effort: 'low', baseUrl: 'http://verifier.example/v1' },
    )

    await ctx.verifier.select(request())
    const captured = JSON.parse(await readFile(capture, 'utf8')) as Record<string, unknown>
    expect(captured).toEqual({
      compatible: '1',
      maxTokens: '4096',
      effort: 'low',
      baseUrl: 'http://verifier.example/v1',
      credential: 'explicit-secret',
      payloadModel: 'deepseek-chat',
    })
  })

  it('omits DeepSeek-compatible environment by default', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-verifier-plain-'))
    roots.push(root)
    const capture = join(root, 'capture.json')
    const bridge = await fixture(`
      import fs from 'node:fs';
      fs.readFileSync(0, 'utf8');
      fs.writeFileSync(${JSON.stringify(capture)}, JSON.stringify({
        compatible: process.env.LLM_VERIFIER_DEEPSEEK_COMPATIBLE,
        maxTokens: process.env.DEEPSEEK_MAX_TOKENS,
        effort: process.env.DEEPSEEK_EFFORT,
      }));
      process.stdout.write(${JSON.stringify(successResult())});
    `)
    const ctx = await setup(bridge, undefined, { baseUrl: 'http://verifier.example/v1' })

    await ctx.verifier.select(request())
    const captured = JSON.parse(await readFile(capture, 'utf8')) as Record<string, unknown>
    expect(captured).toEqual({ compatible: undefined, maxTokens: undefined, effort: undefined })
  })

  it('rejects missing credentials before spawning a multi-candidate bridge', async () => {
    const bridge = await fixture('throw new Error("must not run")')
    const ctx = await setup(bridge, {})
    await expect(ctx.verifier.select(request())).rejects.toMatchObject({ code: 'CREDENTIAL_MISSING' })
  })

  it('rejects stdout beyond the configured byte cap', async () => {
    const bridge = await fixture("process.stdout.write('x'.repeat(4096))")
    const ctx = await setup(bridge, undefined, { maxOutputBytes: 1024 })
    await expect(ctx.verifier.select(request())).rejects.toMatchObject({ code: 'OUTPUT_LIMIT' })
  })

  it('rejects stderr beyond the configured byte cap', async () => {
    const bridge = await fixture("process.stderr.write('x'.repeat(4096))")
    const ctx = await setup(bridge, undefined, { maxOutputBytes: 1024 })
    await expect(ctx.verifier.select(request())).rejects.toMatchObject({ code: 'OUTPUT_LIMIT' })
  })

  it('rejects malformed and internally inconsistent selection output', async () => {
    const malformed = await fixture("process.stdout.write('{bad json')")
    const malformedCtx = await setup(malformed)
    await expect(malformedCtx.verifier.select(request())).rejects.toMatchObject({ code: 'PROTOCOL_INVALID' })

    const inconsistent = await fixture(`process.stdout.write(${JSON.stringify(successResult({ ranking: [0, 1] }))})`)
    const inconsistentCtx = await setup(inconsistent)
    await expect(inconsistentCtx.verifier.select(request())).rejects.toMatchObject({ code: 'PROTOCOL_INVALID' })
  })

  it('keeps the production bridge and requirement on the same exact package version', async () => {
    expect(PYTHON_BRIDGE).toContain('PACKAGE_VERSION = "0.2.0"')
    expect(LLM_VERIFIER_REQUIREMENT).toBe('llm-verifier==0.2.0')
    expect(credentialRef('TEST_VERIFIER_KEY')).toBe('TEST_VERIFIER_KEY')
  })

  it('embeds the DeepSeek-compatible tag in the production bridge', async () => {
    expect(PYTHON_BRIDGE).toContain('LLM_VERIFIER_DEEPSEEK_COMPATIBLE')
    expect(PYTHON_BRIDGE).toContain('_llm_verifier_deepseek')
  })
})
