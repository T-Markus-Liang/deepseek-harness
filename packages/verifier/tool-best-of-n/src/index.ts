/** Fixed best-of-N coding workflow over isolated Git worktrees. @module @deepseek-ai/dsh-tool-best-of-n */

import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { AgentOptions } from '@deepseek-ai/dsh-agent'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { SubprocessOutputReader } from '@deepseek-ai/dsh-subprocess'
import type { SubagentRun } from '@deepseek-ai/dsh-subagent'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-verifier'

export const name = 'tool-best-of-n'
export const inject = ['tools', 'subagents', 'subprocess', 'verifier']

/** Deployment policy for candidate generation, scoring, and patch promotion. */
export interface Config {
  /** Model-facing tool name. Defaults to `best_of_n`. */
  toolName?: string
  /** One-shot subagent provider that must advertise `workspaceCwd`. */
  subagentProvider?: string
  /** Optional provider override for every candidate agent. */
  candidateProvider?: string
  /** Optional model override for every candidate agent. */
  candidateModel?: string
  /** Optional maximum output tokens for every candidate agent. */
  candidateMaxTokens?: number
  /** Verifier backend model identifier. Defaults to `deepseek-chat`. */
  verifierModel?: string
  /** Repeated verifier evaluations per criterion. Defaults to 4. */
  nEvaluations?: number
  /** Tournament pivot count, capped to the requested candidate count. */
  pivots?: number
  /** Maximum concurrent verifier calls. Defaults to 4. */
  maxConcurrency?: number
  /** Maximum candidate agents accepted by one tool call. */
  maxCandidates?: number
  /** Maximum characters in each completed candidate trajectory. */
  maxTrajectoryChars?: number
  /** Independent byte limit for each Git subprocess output stream. */
  maxGitOutputBytes?: number
  /** Grace period for terminating a Git subprocess tree. */
  gitGraceMs?: number
}

export const Config: z<Config> = z.object({
  toolName: z.string().default('best_of_n'),
  subagentProvider: z.string().default('spawn'),
  candidateProvider: z.string(),
  candidateModel: z.string(),
  candidateMaxTokens: z.number().step(1).min(1),
  verifierModel: z.string().default('deepseek-chat'),
  nEvaluations: z.number().step(1).min(1).default(4),
  pivots: z.number().step(1).min(1).default(2),
  maxConcurrency: z.number().step(1).min(1).default(4),
  maxCandidates: z.number().step(1).min(2).max(32).default(5),
  maxTrajectoryChars: z.number().step(1).min(1).default(1_000_000),
  maxGitOutputBytes: z.number().step(1).min(1024).default(16_777_216),
  gitGraceMs: z.number().step(1).min(1).default(2_000),
})

interface ResolvedConfig {
  toolName: string
  subagentProvider: string
  agentOptions?: AgentOptions
  verifierModel: string
  nEvaluations: number
  pivots: number
  maxConcurrency: number
  maxCandidates: number
  maxTrajectoryChars: number
  maxGitOutputBytes: number
  gitGraceMs: number
}

function positive(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive safe integer`)
  return value
}

function normalized(value: string, name: string): string {
  if (value.length === 0 || value.trim() !== value) throw new TypeError(`${name} must be normalized and non-empty`)
  return value
}

function requiredAt<T>(values: readonly T[], index: number, label: string): T {
  const value = values[index]
  if (value === undefined) throw new Error(`${label} index ${index} is out of range`)
  return value
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

function resolveConfig(config: Config): ResolvedConfig {
  const agentOptions = config.candidateProvider === undefined
    && config.candidateModel === undefined
    && config.candidateMaxTokens === undefined
    ? undefined
    : {
      ...(config.candidateProvider === undefined ? {} : { provider: config.candidateProvider }),
      ...(config.candidateModel === undefined ? {} : { model: config.candidateModel }),
      ...(config.candidateMaxTokens === undefined ? {} : { maxTokens: positive(config.candidateMaxTokens, 'candidateMaxTokens') }),
    }
  return {
    toolName: normalized(config.toolName ?? 'best_of_n', 'toolName'),
    subagentProvider: normalized(config.subagentProvider ?? 'spawn', 'subagentProvider'),
    ...(agentOptions === undefined ? {} : { agentOptions }),
    verifierModel: normalized(config.verifierModel ?? 'deepseek-chat', 'verifierModel'),
    nEvaluations: positive(config.nEvaluations ?? 4, 'nEvaluations'),
    pivots: positive(config.pivots ?? 2, 'pivots'),
    maxConcurrency: positive(config.maxConcurrency ?? 4, 'maxConcurrency'),
    maxCandidates: positive(config.maxCandidates ?? 5, 'maxCandidates'),
    maxTrajectoryChars: positive(config.maxTrajectoryChars ?? 1_000_000, 'maxTrajectoryChars'),
    maxGitOutputBytes: positive(config.maxGitOutputBytes ?? 16_777_216, 'maxGitOutputBytes'),
    gitGraceMs: positive(config.gitGraceMs ?? 2_000, 'gitGraceMs'),
  }
}

interface GitResult { exitCode: number | null; stdout: string; stderr: string }

function collected(reader: SubprocessOutputReader | undefined, label: string): string {
  if (reader === undefined) throw new Error(`${label} was not collected`)
  const value = reader.readFrom(0)
  if (value.lossy) throw new Error(`${label} exceeded maxGitOutputBytes`)
  return value.text
}

class GitWorktrees {
  private executable: string | undefined
  constructor(private readonly ctx: Context, private readonly config: ResolvedConfig) {}

  private async git(cwd: string, args: readonly string[], signal?: AbortSignal, stdin?: string): Promise<GitResult> {
    this.executable ??= await this.ctx.subprocess.resolveExecutable('git', { GIT_OPTIONAL_LOCKS: '0' }, signal)
    const handle = this.ctx.subprocess.spawn({
      argv: [this.executable, '-c', 'core.quotepath=false', '-c', 'diff.external=', ...args],
      cwd,
      stdio: {
        stdin: stdin === undefined ? 'ignore' : { data: stdin },
        stdout: { maxBytes: this.config.maxGitOutputBytes },
        stderr: { maxBytes: this.config.maxGitOutputBytes },
      },
      graceMs: this.config.gitGraceMs,
      signal,
      env: { GIT_OPTIONAL_LOCKS: '0', GIT_PAGER: 'cat', PAGER: 'cat', GIT_TERMINAL_PROMPT: '0' },
    })
    const outcome = await handle.done
    if (signal?.aborted === true) await handle.waitForExit()
    return {
      exitCode: outcome.exitCode,
      stdout: collected(handle.collected.stdout, 'git stdout'),
      stderr: collected(handle.collected.stderr, 'git stderr'),
    }
  }

  private success(result: GitResult, action: string): string {
    if (result.exitCode !== 0) throw new Error(`${action} failed: ${result.stderr.trim() || `exit ${String(result.exitCode)}`}`)
    return result.stdout
  }

  async repository(cwd: string, signal: AbortSignal): Promise<{ root: string; base: string }> {
    const root = this.success(await this.git(cwd, ['rev-parse', '--show-toplevel'], signal), 'Git repository discovery').trim()
    const status = this.success(await this.git(root, ['status', '--porcelain=v1', '--untracked-files=all'], signal), 'Git status')
    if (status.length !== 0) throw new Error('best_of_n requires a clean parent Git worktree')
    const base = this.success(await this.git(root, ['rev-parse', 'HEAD'], signal), 'Git HEAD resolution').trim()
    return { root: resolve(root), base }
  }

  async create(root: string, path: string, base: string, signal: AbortSignal): Promise<void> {
    this.success(await this.git(root, ['worktree', 'add', '--detach', path, base], signal), 'Git worktree creation')
  }

  async patch(path: string, base: string, signal: AbortSignal): Promise<string> {
    this.success(await this.git(path, ['add', '-A'], signal), 'candidate staging')
    return this.success(await this.git(path, ['diff', '--no-ext-diff', '--cached', '--binary', base], signal), 'candidate patch extraction')
  }

  async assertStillClean(root: string, base: string, signal: AbortSignal): Promise<void> {
    const head = this.success(await this.git(root, ['rev-parse', 'HEAD'], signal), 'Git HEAD recheck').trim()
    const status = this.success(await this.git(root, ['status', '--porcelain=v1', '--untracked-files=all'], signal), 'Git status recheck')
    if (head !== base || status.length !== 0) throw new Error('parent Git worktree changed while best_of_n candidates were running')
  }

  async apply(root: string, patch: string, signal: AbortSignal): Promise<void> {
    if (patch.length === 0) return
    this.success(await this.git(root, ['apply', '--binary', '--whitespace=nowarn', '-'], signal, patch), 'winner patch promotion')
  }

  async remove(root: string, path: string): Promise<void> {
    const result = await this.git(root, ['worktree', 'remove', '--force', path])
    if (result.exitCode !== 0) throw new Error(`Git worktree cleanup failed for ${path}: ${result.stderr.trim()}`)
  }

  async prune(root: string): Promise<void> {
    this.success(await this.git(root, ['worktree', 'prune']), 'Git worktree prune')
  }
}

const USAGE_SCHEMA = {
  type: 'object', required: true, additionalProperties: false,
  properties: {
    calls: { type: 'integer', required: true },
    inputTokens: { type: 'integer', required: true },
    cachedInputTokens: { type: 'integer', required: true },
    uncachedInputTokens: { type: 'integer', required: true },
    outputTokens: { type: 'integer', required: true },
    reasoningTokens: { type: 'integer', required: true },
  },
} as const

/** Register the fixed generation, verification, and winner-promotion workflow. */
export function apply(ctx: Context, config: Config): void {
  const resolved = resolveConfig(config)
  ctx.tools.register(defineTool({
    name: resolved.toolName,
    description: 'Run several independent coding candidates in isolated detached Git worktrees, rank their complete Sessions with the configured verifier, apply only the winning patch to the clean parent worktree, and discard the losing worktrees.',
    parameters: {
      objective: { type: 'string', required: true, description: 'One coding task for every candidate.' },
      criteria: {
        type: 'array', required: true, description: 'Independent criteria used to rank candidate trajectories.',
        items: {
          type: 'object', additionalProperties: false,
          properties: { name: { type: 'string', required: true }, description: { type: 'string', required: true } },
        },
      },
      candidates: { type: 'integer', required: true, description: 'Number of independent candidates to generate.' },
      seed: { type: 'integer', description: 'Deterministic verifier tournament seed; defaults to 0.' },
    },
    output: {
      schema: {
        type: 'object', additionalProperties: false,
        properties: {
          winnerSessionId: { type: 'string', required: true },
          candidateSessionIds: { type: 'array', required: true, items: { type: 'string' } },
          rankingSessionIds: { type: 'array', required: true, items: { type: 'string' } },
          scores: { type: 'array', required: true, items: { type: 'number' } },
          comparisons: { type: 'integer', required: true },
          promoted: { type: 'boolean', required: true },
          usage: USAGE_SCHEMA,
        },
      },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const parent = exec.agent
      if (parent === undefined) throw new Error('best_of_n requires a calling agent')
      if (args.objective.length === 0 || args.criteria.length === 0
        || args.criteria.some(item => item.name.length === 0 || item.description.length === 0)) {
        throw new Error('objective and every criterion name/description must be non-empty')
      }
      if (!Number.isSafeInteger(args.candidates) || args.candidates < 2 || args.candidates > resolved.maxCandidates) {
        throw new Error(`candidates must be an integer from 2 through ${resolved.maxCandidates}`)
      }
      const provider = ctx.subagents.getProvider(resolved.subagentProvider)
      if (provider === undefined) throw new Error(`subagent provider ${JSON.stringify(resolved.subagentProvider)} is not registered`)
      if (provider.capabilities.workspaceCwd !== true) {
        throw new Error(`subagent provider ${JSON.stringify(resolved.subagentProvider)} does not support isolated workspace cwd`)
      }
      const parentCwd = parent.session.header.cwd
      if (parentCwd === undefined) throw new Error('best_of_n requires the parent Session to have a workspace cwd')

      const git = new GitWorktrees(ctx, resolved)
      const repository = await git.repository(parentCwd, exec.signal)
      const operationRoot = await mkdtemp(join(tmpdir(), 'dsh-best-of-n-'))
      const paths = Array.from({ length: args.candidates }, (_, index) => join(operationRoot, `candidate-${index + 1}`))
      const createdPaths: string[] = []
      const runs: SubagentRun[] = []
      let preservePath: string | undefined
      let operationFailure: Error | undefined
      let cleanupFailure: Error | undefined
      try {
        for (const path of paths) {
          await git.create(repository.root, path, repository.base, exec.signal)
          createdPaths.push(path)
        }
        const prompt: ContentBlock[] = [{
          type: 'text',
          text: `${args.objective}\n\nWork independently in the provided isolated workspace. Inspect the repository, implement the task completely, and run focused verification. Do not modify paths outside this workspace.`,
        }]
        const startResults = await Promise.allSettled(paths.map(async (path, index) => {
          const run = await ctx.subagents.start(resolved.subagentProvider, {
            label: `best-of-${args.candidates} candidate ${index + 1}`,
            prompt,
            parent,
            signal: exec.signal,
            workspaceCwd: path,
            ...(resolved.agentOptions === undefined ? {} : { agentOptions: resolved.agentOptions }),
          })
          runs.push(run)
          return run
        }))
        const startFailure = startResults.find(item => item.status === 'rejected')
        if (startFailure?.status === 'rejected') throw startFailure.reason
        const started = startResults.map((item) => {
          if (item.status === 'rejected') throw item.reason
          return item.value
        })
        const outcomes = await Promise.all(started.map(run => run.result))
        const localAgents = started.map((run, index) => {
          if (run.localAgent === undefined) throw new Error(`candidate ${index + 1} did not expose a local Session`)
          return run.localAgent
        })
        for (const [index, outcome] of outcomes.entries()) {
          if (outcome.stopReason !== 'completed') {
            throw new Error(`candidate ${index + 1} ended with ${outcome.stopReason}`)
          }
        }
        const trajectories = localAgents.map((agent, index) => {
          const trajectory = JSON.stringify(agent.session.deriveMessages())
          if (trajectory.length > resolved.maxTrajectoryChars) {
            throw new Error(`candidate ${index + 1} trajectory exceeds maxTrajectoryChars`)
          }
          return trajectory
        })
        const selected = await ctx.verifier.select({
          problem: args.objective,
          candidates: trajectories,
          criteria: args.criteria,
          model: resolved.verifierModel,
          nEvaluations: resolved.nEvaluations,
          pivots: Math.min(resolved.pivots, args.candidates),
          seed: args.seed ?? 0,
          maxConcurrency: resolved.maxConcurrency,
          signal: exec.signal,
        })
        const winnerPath = requiredAt(paths, selected.index, 'winner')
        preservePath = winnerPath
        let patch: string
        try {
          patch = await git.patch(winnerPath, repository.base, exec.signal)
          await git.assertStillClean(repository.root, repository.base, exec.signal)
          await git.apply(repository.root, patch, exec.signal)
        } catch (error) {
          const failure = toError(error)
          throw new Error(`${failure.message}; winning worktree preserved at ${winnerPath}`, { cause: failure })
        }
        preservePath = undefined
        const sessionIds = started.map(run => String(run.id))
        return {
          winnerSessionId: requiredAt(sessionIds, selected.index, 'winner Session'),
          candidateSessionIds: sessionIds,
          rankingSessionIds: selected.ranking.map(index => requiredAt(sessionIds, index, 'ranking Session')),
          scores: [...selected.scores],
          comparisons: selected.comparisons,
          promoted: patch.length > 0,
          usage: selected.usage,
        }
      } catch (error) {
        operationFailure = toError(error)
        throw operationFailure
      } finally {
        const settledRuns = await Promise.allSettled(runs.map(run => run.dispose()))
        const rejectedDispose = settledRuns.find(item => item.status === 'rejected')
        if (rejectedDispose?.status === 'rejected') cleanupFailure = toError(rejectedDispose.reason)
        for (const path of createdPaths) {
          if (path === preservePath) continue
          try { await git.remove(repository.root, path) } catch (error) { cleanupFailure ??= toError(error) }
        }
        try { await git.prune(repository.root) } catch (error) { cleanupFailure ??= toError(error) }
        if (preservePath === undefined) await rm(operationRoot, { recursive: true, force: true })
        if (cleanupFailure !== undefined) {
          if (operationFailure === undefined) throw cleanupFailure
          throw new Error(`${operationFailure.message}; cleanup also failed: ${cleanupFailure.message}`, {
            cause: new AggregateError([operationFailure, cleanupFailure]),
          })
        }
      }
    },
    presentCall: args => ({ card: 'generic', kind: 'execute', title: 'Run best-of-N', rawInput: `${args.candidates} candidates` }),
    presentResult: (_args, result) => result.isError ? undefined : { card: 'generic', title: 'Best candidate promoted' },
  }))
}
