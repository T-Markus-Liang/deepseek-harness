/** Model-facing ranking of existing durable candidate Sessions. @module @deepseek-ai/dsh-tool-verify-candidates */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-session-persistence'
import type {} from '@deepseek-ai/dsh-verifier'

export const name = 'tool-verify-candidates'
export const inject = ['tools', 'sessionPersistence', 'verifier']

/** Deployment-owned verifier cost and trajectory limits. */
export interface Config {
  /** Model-facing tool name. Defaults to `verify_candidates`. */
  toolName?: string
  /** Verifier backend model identifier. Defaults to `deepseek-chat`. */
  model?: string
  /** Repeated evaluations per criterion. Defaults to 4. */
  nEvaluations?: number
  /** Tournament pivot count, capped to the request's candidate count. */
  pivots?: number
  /** Maximum concurrent verifier calls. Defaults to 4. */
  maxConcurrency?: number
  /** Maximum durable Session ids accepted by one tool call. */
  maxCandidates?: number
  /** Maximum characters in each projected Session trajectory. */
  maxTrajectoryChars?: number
}

export const Config: z<Config> = z.object({
  toolName: z.string().default('verify_candidates'),
  model: z.string().default('deepseek-chat'),
  nEvaluations: z.number().step(1).min(1).default(4),
  pivots: z.number().step(1).min(1).default(2),
  maxConcurrency: z.number().step(1).min(1).default(4),
  maxCandidates: z.number().step(1).min(1).max(128).default(8),
  maxTrajectoryChars: z.number().step(1).min(1).default(1_000_000),
})

interface ResolvedConfig {
  toolName: string
  model: string
  nEvaluations: number
  pivots: number
  maxConcurrency: number
  maxCandidates: number
  maxTrajectoryChars: number
}

function positive(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive safe integer`)
  return value
}

function requiredAt<T>(values: readonly T[], index: number, label: string): T {
  const value = values[index]
  if (value === undefined) throw new Error(`${label} index ${index} is out of range`)
  return value
}

function resolveConfig(config: Config): ResolvedConfig {
  const toolName = config.toolName ?? 'verify_candidates'
  const model = config.model ?? 'deepseek-chat'
  if (toolName.length === 0 || toolName.trim() !== toolName) throw new TypeError('toolName must be normalized and non-empty')
  if (model.length === 0 || model.trim() !== model) throw new TypeError('model must be normalized and non-empty')
  return {
    toolName,
    model,
    nEvaluations: positive(config.nEvaluations ?? 4, 'nEvaluations'),
    pivots: positive(config.pivots ?? 2, 'pivots'),
    maxConcurrency: positive(config.maxConcurrency ?? 4, 'maxConcurrency'),
    maxCandidates: positive(config.maxCandidates ?? 8, 'maxCandidates'),
    maxTrajectoryChars: positive(config.maxTrajectoryChars ?? 1_000_000, 'maxTrajectoryChars'),
  }
}

/**
 * Project exactly the current model-visible message surface from one Session log.
 * @param id - candidate Session identity used in size diagnostics.
 * @param events - complete contiguous candidate event log.
 * @param maxChars - maximum serialized trajectory characters.
 * @returns the serialized current model-visible message list.
 */
export function projectCandidateTrajectory(id: string, events: readonly SessionEvent[], maxChars: number): string {
  const messages = Session.create(SessionId(id), events).deriveMessages()
  const trajectory = JSON.stringify(messages)
  if (trajectory.length > maxChars) {
    throw new Error(`candidate Session ${JSON.stringify(id)} trajectory exceeds maxTrajectoryChars (${trajectory.length} > ${maxChars})`)
  }
  return trajectory
}

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    winnerSessionId: { type: 'string', required: true },
    rankingSessionIds: { type: 'array', required: true, items: { type: 'string' } },
    scores: { type: 'array', required: true, items: { type: 'number' } },
    comparisons: { type: 'integer', required: true },
    usage: {
      type: 'object',
      required: true,
      additionalProperties: false,
      properties: {
        calls: { type: 'integer', required: true },
        inputTokens: { type: 'integer', required: true },
        cachedInputTokens: { type: 'integer', required: true },
        uncachedInputTokens: { type: 'integer', required: true },
        outputTokens: { type: 'integer', required: true },
        reasoningTokens: { type: 'integer', required: true },
      },
    },
  },
} as const

/** Register the opt-in `verify_candidates` tool. */
export function apply(ctx: Context, config: Config): void {
  const resolved = resolveConfig(config)
  ctx.tools.register(defineTool({
    name: resolved.toolName,
    description: 'Rank existing candidate Sessions from the caller workspace that attempted the same task. Supply durable Session ids in the order to score; the tool reads their current model-visible trajectories and returns the winner and complete ranking.',
    parameters: {
      problem: { type: 'string', required: true, description: 'The task every candidate attempted.' },
      candidateSessionIds: {
        type: 'array',
        required: true,
        description: 'Distinct durable candidate Session ids, in stable input order.',
        items: { type: 'string' },
      },
      criteria: {
        type: 'array',
        required: true,
        description: 'Independent evaluation criteria.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', required: true },
            description: { type: 'string', required: true },
          },
        },
      },
      seed: { type: 'integer', description: 'Deterministic tournament seed; defaults to 0.' },
    },
    output: {
      schema: OUTPUT_SCHEMA,
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const caller = exec.agent
      if (caller === undefined || caller.session.header.cwd === undefined) {
        throw new Error('verify_candidates requires an agent-bound caller with a workspace cwd')
      }
      const ids = args.candidateSessionIds
      if (ids.length === 0 || ids.length > resolved.maxCandidates) {
        throw new Error(`candidateSessionIds must contain 1-${resolved.maxCandidates} ids`)
      }
      if (new Set(ids).size !== ids.length || ids.some(id => id.length === 0 || id.trim() !== id)) {
        throw new Error('candidateSessionIds must contain distinct normalized non-empty ids')
      }
      if (args.problem.length === 0 || args.criteria.length === 0
        || args.criteria.some(item => item.name.length === 0 || item.description.length === 0)) {
        throw new Error('problem and every criterion name/description must be non-empty')
      }
      const inspected = await Promise.all(ids.map(async (id) => {
        try {
          const item = await ctx.sessionPersistence.inspect(SessionId(id), exec.signal)
          exec.signal.throwIfAborted()
          if (item.meta.cwd !== caller.session.header.cwd) throw new Error('workspace mismatch')
          return item
        } catch (error) {
          exec.signal.throwIfAborted()
          ctx.logger.warn('tool-verify-candidates: candidate %s is unavailable or outside the caller workspace: %s', id, error)
          throw new Error('a candidate Session is unavailable or outside the caller workspace')
        }
      }))
      const candidates = inspected.map((item, index) => projectCandidateTrajectory(
        requiredAt(ids, index, 'candidate Session'),
        item.events,
        resolved.maxTrajectoryChars,
      ))
      const selected = await ctx.verifier.select({
        problem: args.problem,
        candidates,
        criteria: args.criteria,
        model: resolved.model,
        nEvaluations: resolved.nEvaluations,
        pivots: Math.min(resolved.pivots, ids.length),
        seed: args.seed ?? 0,
        maxConcurrency: resolved.maxConcurrency,
        signal: exec.signal,
      })
      return {
        winnerSessionId: requiredAt(ids, selected.index, 'winner Session'),
        rankingSessionIds: selected.ranking.map(index => requiredAt(ids, index, 'ranking Session')),
        scores: [...selected.scores],
        comparisons: selected.comparisons,
        usage: selected.usage,
      }
    },
    presentCall: args => ({ card: 'generic', kind: 'other', title: 'Verify candidates', rawInput: `${args.candidateSessionIds.length} Sessions` }),
    presentResult: (_args, result) => result.isError
      ? undefined
      : { card: 'generic', title: 'Candidate ranking complete' },
  }))
}
