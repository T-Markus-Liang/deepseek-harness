/**
 * Function plugin registering the `sessionStats` projection unit: whole-log
 * turn/step counts and LLM/tool/first-token/decode wall times served through
 * the session-projection seam (registry snapshot, change feed, and every
 * projection carrier), so clients render full-session figures that paging and
 * compaction cannot change. The plugin owns only the fold; delivery is the
 * seam's.
 *
 * @module @deepseek-ai/dsh-session-stats
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Session } from '@deepseek-ai/dsh-session'
import z from '@deepseek-ai/schemastery'
import { sessionStatsProjectionDefinition } from './projection.ts'

export type * from './types.ts'

/** Cordis plugin name. */
export const name = 'session-stats'
/** The projection registry is the plugin's whole purpose; without it the fiber stays pending. */
export const inject = ['sessionProjections']

/**
 * Optional step stall threshold in milliseconds. When set, the plugin monitors
 * open step duration and warns when a step exceeds this threshold.
 * Omit (or set to 0) to disable stall detection.
 */
export interface Config {
  /** Milliseconds after which a step is considered stalled. Omit for no detection. */
  stallThresholdMs?: number
}

/** Schemastery validation for {@link Config}: a non-negative integer threshold, or omitted. */
export const Config: z<Config> = z.object({
  stallThresholdMs: z.natural(),
})

/**
 * Register the `sessionStats` unit; the registration is an effect on this
 * plugin's fiber, so unloading removes the key.
 * @param ctx - registrant context carrying the projection registry.
 * @param config - optional stall detection threshold.
 */
export function apply(ctx: Context, config: Config = {}): void {
  ctx.sessionProjections.register(sessionStatsProjectionDefinition)
  if (config.stallThresholdMs !== undefined && config.stallThresholdMs > 0) {
    installStallMonitor(ctx, config.stallThresholdMs)
  }
}

/**
 * Install a stall monitor that arms a per-session timer on `step/start` and
 * warns through the logger when the step stays open past the threshold. The
 * timer is cancelled by the matching `step/end`, by `turn/end`, and by fiber
 * dispose, so a pending warning can neither fire for a closed boundary nor
 * outlive the plugin.
 * @param ctx - plugin context for event listening.
 * @param thresholdMs - stall threshold in milliseconds.
 */
function installStallMonitor(ctx: Context, thresholdMs: number): void {
  const timers = new Map<Session, { turn: number; step: number; timer: ReturnType<typeof setTimeout> }>()

  ctx.on('session/event', (session, event) => {
    switch (event.type) {
      case 'step/start': {
        const { turn, step } = event.data
        const timer = setTimeout(() => {
          const elapsedMs = Date.now() - event.time
          ctx.logger.warn(
            `session "${session.id}": step stall — turn %d step %d has run %dms (threshold %dms)`,
            turn, step, elapsedMs, thresholdMs,
          )
        }, thresholdMs)
        timer.unref()
        const existing = timers.get(session)
        if (existing) clearTimeout(existing.timer)
        timers.set(session, { turn, step, timer })
        break
      }
      case 'step/end': {
        const existing = timers.get(session)
        if (existing && existing.turn === event.data.turn && existing.step === event.data.step) {
          clearTimeout(existing.timer)
          timers.delete(session)
        }
        break
      }
      case 'turn/end': {
        const existing = timers.get(session)
        if (existing) {
          clearTimeout(existing.timer)
          timers.delete(session)
        }
        break
      }
      default:
        // Merge-extensible session events: only step boundaries arm or clear a timer.
        break
    }
  })

  // Clear pending timers with the plugin (their sessions outlive the fiber).
  ctx.effect(() => () => {
    for (const { timer } of timers.values()) clearTimeout(timer)
    timers.clear()
  }, 'session-stats.stall-monitor')
}
