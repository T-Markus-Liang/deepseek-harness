/** Pinned Python JSON-bridge provider for llm-verifier 0.2.0. @module @deepseek-ai/dsh-verifier-python */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { CredentialRef } from '@deepseek-ai/dsh-credentials'
import type { SubprocessOutputReader } from '@deepseek-ai/dsh-subprocess'
import { Verifier } from '@deepseek-ai/dsh-verifier'
import type { VerifierSelectRequest, VerifierSelection, VerifierUsage } from '@deepseek-ai/dsh-verifier'
import { LLM_VERIFIER_REQUIREMENT, PYTHON_BRIDGE } from './bridge.ts'

export { LLM_VERIFIER_REQUIREMENT }

export const name = 'verifier-python'
export const inject = ['subprocess', 'credentials']
/** JSON protocol version shared with the embedded Python bridge. */
export const BRIDGE_PROTOCOL_VERSION = 1
/** Exact upstream package version accepted by the embedded Python bridge. */
export const LLM_VERIFIER_VERSION = '0.2.0'

/** Machine-routable bridge failure categories. */
export type PythonVerifierErrorCode =
  | 'INVALID_REQUEST'
  | 'CREDENTIAL_MISSING'
  | 'SPAWN_FAILED'
  | 'CANCELLED'
  | 'EXIT_FAILED'
  | 'OUTPUT_LIMIT'
  | 'PROTOCOL_INVALID'
  | 'BRIDGE_ERROR'

/** Failure produced before or across the Python process boundary. */
export class PythonVerifierError extends Error {
  constructor(message: string, readonly code: PythonVerifierErrorCode, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PythonVerifierError'
  }
}

/** Deployment policy for the pinned bridge. */
export interface Config {
  /** Python executable resolved through the subprocess service. Defaults to `python3`. */
  pythonCommand?: string
  /** Optional deployment-owned bridge file; omitted uses the embedded pinned bridge. */
  bridgePath?: string
  /** Credential reference resolved for multi-candidate selections. Defaults to `DEEPSEEK_API_KEY`. */
  credentialRef?: string
  /** Environment variable receiving the resolved credential in the private process. */
  credentialEnv?: string
  /** Optional OpenAI-compatible base URL passed to the verifier process. */
  baseUrl?: string
  /**
   * Whether the configured endpoint is DeepSeek-compatible: it emits the score tags itself and
   * returns token-level logprobs, skipping the vLLM/SGLang prefill branch. Defaults to false.
   */
  deepseekCompatible?: boolean
  /** Output token budget for a DeepSeek-compatible backend; sets `DEEPSEEK_MAX_TOKENS` in the bridge process. Defaults to 8192. */
  maxTokens?: number
  /** Reasoning effort for a DeepSeek-compatible backend; sets `DEEPSEEK_EFFORT`. Defaults to `off`. */
  effort?: 'off' | 'low' | 'high' | 'max'
  /** Maximum candidates accepted by one selection. Defaults to 16. */
  maxCandidates?: number
  /** Maximum characters accepted in each serialized candidate trajectory. */
  maxCandidateChars?: number
  /** Maximum characters accepted in the shared problem statement. */
  maxProblemChars?: number
  /** Independent byte limit applied to bridge stdout and stderr. */
  maxOutputBytes?: number
  /** Grace period for terminating the complete Python process tree. */
  graceMs?: number
}

export const Config: z<Config> = z.object({
  pythonCommand: z.string().default('python3'),
  bridgePath: z.string(),
  credentialRef: z.string().default('DEEPSEEK_API_KEY'),
  credentialEnv: z.string().default('DEEPSEEK_API_KEY'),
  baseUrl: z.string(),
  deepseekCompatible: z.boolean().default(false),
  maxTokens: z.number().step(1).min(1).default(8192),
  effort: z.union(['off', 'low', 'high', 'max']).default('off'),
  maxCandidates: z.number().step(1).min(1).max(128).default(16),
  maxCandidateChars: z.number().step(1).min(1).default(1_000_000),
  maxProblemChars: z.number().step(1).min(1).default(100_000),
  maxOutputBytes: z.number().step(1).min(1024).default(1_048_576),
  graceMs: z.number().step(1).min(1).default(2_000),
})

interface ResolvedConfig {
  pythonCommand: string
  bridgePath?: string
  credentialRef: CredentialRef
  credentialEnv: string
  baseUrl?: string
  deepseekCompatible: boolean
  maxTokens: number
  effort: 'off' | 'low' | 'high' | 'max'
  maxCandidates: number
  maxCandidateChars: number
  maxProblemChars: number
  maxOutputBytes: number
  graceMs: number
}

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive safe integer`)
  return value
}

function resolveConfig(config: Config): ResolvedConfig {
  const pythonCommand = config.pythonCommand ?? 'python3'
  const bridgePath = config.bridgePath
  const credentialEnv = config.credentialEnv ?? 'DEEPSEEK_API_KEY'
  if (pythonCommand.trim() !== pythonCommand || pythonCommand.length === 0) throw new TypeError('pythonCommand must be normalized and non-empty')
  if (bridgePath !== undefined && (bridgePath.trim() !== bridgePath || bridgePath.length === 0)) throw new TypeError('bridgePath must be normalized and non-empty')
  if (!ENV_NAME.test(credentialEnv)) throw new TypeError('credentialEnv must be an environment-variable name')
  return {
    pythonCommand,
    ...(bridgePath === undefined ? {} : { bridgePath }),
    credentialRef: credentialRef(config.credentialRef ?? 'DEEPSEEK_API_KEY'),
    credentialEnv,
    ...(config.baseUrl === undefined ? {} : { baseUrl: config.baseUrl }),
    deepseekCompatible: config.deepseekCompatible === true,
    maxTokens: positiveInteger(config.maxTokens ?? 8192, 'maxTokens'),
    effort: config.effort ?? 'off',
    maxCandidates: positiveInteger(config.maxCandidates ?? 16, 'maxCandidates'),
    maxCandidateChars: positiveInteger(config.maxCandidateChars ?? 1_000_000, 'maxCandidateChars'),
    maxProblemChars: positiveInteger(config.maxProblemChars ?? 100_000, 'maxProblemChars'),
    maxOutputBytes: positiveInteger(config.maxOutputBytes ?? 1_048_576, 'maxOutputBytes'),
    graceMs: positiveInteger(config.graceMs ?? 2_000, 'graceMs'),
  }
}

function validateRequest(request: VerifierSelectRequest, config: ResolvedConfig): void {
  if (request.problem.length === 0 || request.problem.length > config.maxProblemChars) {
    throw new PythonVerifierError('problem is empty or exceeds maxProblemChars', 'INVALID_REQUEST')
  }
  if (request.candidates.length === 0 || request.candidates.length > config.maxCandidates) {
    throw new PythonVerifierError('candidate count is outside the configured range', 'INVALID_REQUEST')
  }
  if (request.candidates.some(candidate => candidate.length > config.maxCandidateChars)) {
    throw new PythonVerifierError('a candidate exceeds maxCandidateChars', 'INVALID_REQUEST')
  }
  if (request.criteria.length === 0 || request.criteria.some(item => item.name.length === 0 || item.description.length === 0)) {
    throw new PythonVerifierError('criteria must contain non-empty names and descriptions', 'INVALID_REQUEST')
  }
  positiveInteger(request.nEvaluations, 'nEvaluations')
  positiveInteger(request.pivots, 'pivots')
  positiveInteger(request.maxConcurrency, 'maxConcurrency')
  if (!Number.isSafeInteger(request.seed)) throw new PythonVerifierError('seed must be a safe integer', 'INVALID_REQUEST')
}

function readCollected(reader: SubprocessOutputReader | undefined, stream: string): string {
  if (reader === undefined) throw new PythonVerifierError(`${stream} was not collected`, 'PROTOCOL_INVALID')
  const output = reader.readFrom(0)
  if (output.lossy) throw new PythonVerifierError(`${stream} exceeded maxOutputBytes`, 'OUTPUT_LIMIT')
  return output.text
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function integer(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

function numberArray(value: unknown, length?: number): value is number[] {
  return Array.isArray(value) && (length === undefined || value.length === length)
    && value.every(item => typeof item === 'number' && Number.isFinite(item))
}

function integerArray(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every(integer)
}

function usageFrom(value: unknown): VerifierUsage | undefined {
  const item = record(value)
  if (item === undefined) return
  const keys = ['calls', 'inputTokens', 'cachedInputTokens', 'uncachedInputTokens', 'outputTokens', 'reasoningTokens'] as const
  if (!keys.every(key => integer(item[key]))) return
  return {
    calls: item['calls'] as number,
    inputTokens: item['inputTokens'] as number,
    cachedInputTokens: item['cachedInputTokens'] as number,
    uncachedInputTokens: item['uncachedInputTokens'] as number,
    outputTokens: item['outputTokens'] as number,
    reasoningTokens: item['reasoningTokens'] as number,
  }
}

function decodeResponse(text: string, candidateCount: number): VerifierSelection {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new PythonVerifierError('bridge stdout is not one JSON value', 'PROTOCOL_INVALID', { cause: error })
  }
  const envelope = record(parsed)
  if (envelope?.['protocolVersion'] !== BRIDGE_PROTOCOL_VERSION || envelope['packageVersion'] !== LLM_VERIFIER_VERSION) {
    throw new PythonVerifierError('bridge protocol or package version does not match', 'PROTOCOL_INVALID')
  }
  if (envelope['ok'] === false) {
    const detail = record(envelope['error'])
    const type = typeof detail?.['type'] === 'string' ? detail['type'] : 'Error'
    const message = typeof detail?.['message'] === 'string' ? detail['message'] : 'unknown bridge failure'
    throw new PythonVerifierError(`${type}: ${message}`, 'BRIDGE_ERROR')
  }
  const result = record(envelope['result'])
  const index = result?.['index']
  const scores = result?.['scores']
  const ranking = result?.['ranking']
  const comparisons = result?.['comparisons']
  const criteria = result?.['criteria']
  const usage = usageFrom(result?.['usage'])
  if (!integer(index) || index >= candidateCount || !numberArray(scores, candidateCount)
    || !integerArray(ranking, candidateCount) || new Set(ranking).size !== candidateCount
    || ranking.some(item => item >= candidateCount) || ranking[0] !== index
    || !integer(comparisons) || !Array.isArray(criteria) || !criteria.every(item => typeof item === 'string')
    || usage === undefined) {
    throw new PythonVerifierError('bridge returned an invalid selection result', 'PROTOCOL_INVALID')
  }
  return { index, scores, ranking, comparisons, criteria, usage }
}

/** Local subprocess provider with one private working directory per selection. */
export class PythonVerifier extends Verifier {
  private readonly config: ResolvedConfig

  constructor(ctx: Context, config: Config) {
    super(ctx)
    this.config = resolveConfig(config)
  }

  override async select(request: VerifierSelectRequest): Promise<VerifierSelection> {
    validateRequest(request, this.config)
    request.signal?.throwIfAborted()
    const credential = request.candidates.length === 1
      ? undefined
      : await this.ctx.credentials.resolve(this.config.credentialRef)
    if (request.candidates.length > 1 && credential === undefined) {
      throw new PythonVerifierError(`credential ${String(this.config.credentialRef)} is not configured`, 'CREDENTIAL_MISSING')
    }
    const cwd = await mkdtemp(join(tmpdir(), 'dsh-verifier-'))
    try {
      const bridgePath = this.config.bridgePath ?? join(cwd, 'bridge.py')
      if (this.config.bridgePath === undefined) await writeFile(bridgePath, PYTHON_BRIDGE, { mode: 0o600 })
      let executable: string
      try {
        executable = await this.ctx.subprocess.resolveExecutable(this.config.pythonCommand, undefined, request.signal)
      } catch (error) {
        throw new PythonVerifierError(`cannot resolve Python command ${JSON.stringify(this.config.pythonCommand)}`, 'SPAWN_FAILED', { cause: error })
      }
      const payload = JSON.stringify({
        protocolVersion: BRIDGE_PROTOCOL_VERSION,
        problem: request.problem,
        candidates: request.candidates,
        criteria: request.criteria,
        model: request.model,
        nEvaluations: request.nEvaluations,
        pivots: request.pivots,
        seed: request.seed,
        maxConcurrency: request.maxConcurrency,
      })
      let handle
      try {
        handle = this.ctx.subprocess.spawn({
          argv: [executable, bridgePath],
          cwd,
          stdio: {
            stdin: { data: payload },
            stdout: { maxBytes: this.config.maxOutputBytes },
            stderr: { maxBytes: this.config.maxOutputBytes },
          },
          graceMs: this.config.graceMs,
          signal: request.signal,
          env: {
            PYTHONNOUSERSITE: '1',
            PYTHONDONTWRITEBYTECODE: '1',
            ...(credential === undefined ? {} : { [this.config.credentialEnv]: credential.value }),
            ...(this.config.baseUrl === undefined ? {} : { OPENAI_BASE_URL: this.config.baseUrl }),
            ...(this.config.deepseekCompatible === true
              ? {
                LLM_VERIFIER_DEEPSEEK_COMPATIBLE: '1',
                DEEPSEEK_MAX_TOKENS: String(this.config.maxTokens),
                DEEPSEEK_EFFORT: this.config.effort,
              }
              : {}),
          },
        })
      } catch (error) {
        throw new PythonVerifierError('Python bridge spawn failed', 'SPAWN_FAILED', { cause: error })
      }
      let outcome
      try {
        outcome = await handle.done
      } catch (error) {
        throw new PythonVerifierError('Python bridge could not start', 'SPAWN_FAILED', { cause: error })
      } finally {
        if (request.signal?.aborted === true) await handle.waitForExit()
      }
      if (request.signal?.aborted === true) throw new PythonVerifierError('verifier selection was cancelled', 'CANCELLED')
      const stdout = readCollected(handle.collected.stdout, 'bridge stdout')
      const stderr = readCollected(handle.collected.stderr, 'bridge stderr')
      if (outcome.exitCode !== 0) {
        const detail = stderr.trim().slice(-1000)
        throw new PythonVerifierError(`Python bridge exited with ${String(outcome.exitCode)}${detail.length === 0 ? '' : `: ${detail}`}`, 'EXIT_FAILED')
      }
      return decodeResponse(stdout, request.candidates.length)
    } finally {
      await rm(cwd, { recursive: true, force: true })
    }
  }
}

export function apply(ctx: Context, config: Config): void {
  new PythonVerifier(ctx, config)
}

export default PythonVerifier
