/**
 * Read-only recovery of one continuable child's latest recorded answer.
 *
 * @module @deepseek-ai/dsh-subagent
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { SubagentStopReason } from './types.ts'
import { finalAssistantOutput } from './assistant-output.ts'
import { foldSubagentDescriptor } from './descriptor.ts'
import { SubagentError } from './error.ts'
import { epochStopReason } from './lifecycle.ts'

/** Latest recorded result of one continuable child conversation. */
export interface SubagentConversationResult {
  /** Whether the continuation manager currently owns a live Activation. */
  readonly activity: 'active' | 'inactive'
  /** Last non-empty assistant output recorded in the child's own log suffix. */
  readonly output: ContentBlock[]
  /** Latest recorded terminal reason, absent while an Activation is active. */
  readonly stopReason?: SubagentStopReason
}

/**
 * Read one direct continuable child's latest recorded result without resuming it.
 * @param ctx - context carrying live sessions, agents, and optional persistence.
 * @param parent - exact live direct parent authorizing the read.
 * @param childId - durable child session id.
 * @param active - whether the continuation manager owns a live Activation.
 * @param signal - caller cancellation for a cold persistence inspection.
 * @returns the live-preferred recorded result.
 */
export async function readSubagentResult(
  ctx: Context,
  parent: Agent,
  childId: SessionId,
  active: boolean,
  signal?: AbortSignal,
): Promise<SubagentConversationResult> {
  const agents = ctx.get('agents')
  if (agents === undefined || agents.get(parent.id) !== parent) {
    throw new SubagentError('reading a subagent result requires the exact live parent agent', 'UNAUTHORIZED')
  }
  signal?.throwIfAborted()
  const sessions = ctx.get('sessions')
  if (sessions === undefined) {
    throw new SubagentError(
      'reading a subagent result requires the session store',
      'SUBAGENT_CONTROL_SESSION_STORE_UNAVAILABLE',
    )
  }
  const live = sessions.get(childId)
  let header
  let events: readonly SessionEvent[]
  if (live !== undefined) {
    header = live.header
    events = live.events
  } else {
    const persistence = ctx.get('sessionPersistence')
    if (persistence === undefined) {
      throw new SubagentError(`subagent "${childId}" is unavailable`, 'NOT_RESUMABLE')
    }
    const inspected = await persistence.inspect(childId, signal)
    signal?.throwIfAborted()
    header = inspected.meta
    events = inspected.events
  }
  if (header.origin !== 'subagent' || header.parentSession !== parent.id) {
    throw new SubagentError(`subagent "${childId}" belongs to another parent session`, 'UNAUTHORIZED')
  }
  const own = events.slice(header.seedLength ?? 0)
  const descriptor = foldSubagentDescriptor(own)
  if (descriptor === undefined || descriptor.mode !== 'continuable') {
    throw new SubagentError(`subagent "${childId}" has no continuable result`, 'NOT_RESUMABLE')
  }
  const output = finalAssistantOutput(own) ?? []
  return active
    ? { activity: 'active', output }
    : { activity: 'inactive', output, stopReason: epochStopReason(own) }
}
