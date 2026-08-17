# Session Stats

English | [中文](session-stats.zh.md)

The `sessionStats` projection unit ([@deepseek-ai/dsh-session-stats](../../packages/session/session-stats)) — a domain contributor to the [session-projection seam](session-projection.md) — folds whole-log conversation figures from the durable session log and serves them through the registry snapshot, change feed, and every projection carrier. Whole-log figures survive paging and compaction; the unit owns only the fold, delivery is the seam's. The plugin never touches a model request; the reference consumer is the web chat stats strip, whose window fold mirrors these field names as its no-unit fallback.

Source: [`packages/session/session-stats/src/types.ts`](../../packages/session/session-stats/src/types.ts)

## The projection value

`SessionStatsProjection` is the unit's wire value: turn/step counts and the LLM, tool, first-token, and decode wall times, plus the live open step and in-flight tool calls exposed for external monitoring.

```ts type-equiv
/**
 * Whole-log conversation figures, independent of how much history a client
 * has paged in. Counts and wall times all fold from the complete durable log;
 * every field is 0 until its first contributing event lands. Field names
 * mirror the client window fold so an assembly without this unit can fall
 * back to it wholesale.
 */
interface SessionStatsProjection {
  /** Distinct turns carrying at least one closed step (`step/end`); rejected or empty turns are uncounted. */
  turns: number
  /** Closed steps (`step/end` events) — completed, failed, and cancelled steps alike. */
  steps: number
  /** Summed model wall time (`step/start` → `assistant/message`) over steps that assembled a message. */
  llmMs: number
  /** Summed tool wall time over `tool/call` → `tool/result` pairs matched by callId. */
  toolMs: number
  /** Summed first-token latency (`step/start` → first non-empty delta chunk) over `ttftSteps`. */
  ttftMs: number
  /** Steps carrying a recorded first token. */
  ttftSteps: number
  /** Summed decode wall time (first token → `assistant/message`) over steps that also report output tokens. */
  decodeMs: number
  /** Summed provider output tokens over the same decode-timed steps. */
  decodeTokens: number
  /**
   * Current open step, null when idle. Cleared when the step closes or its
   * message assembles. Exposed for live monitoring (e.g. `session_projcache.json`).
   */
  openStep: { turn: number; step: number; startTime: number; firstTokenTime: number | null } | null
  /**
   * Dispatch times of tool calls whose result has not yet landed, keyed by
   * callId. Pruned when the result lands and dropped wholesale at `turn/end`.
   * Exposed for live monitoring.
   */
  pendingCalls: Record<string, number>
}
```

Every figure is 0 until its first contributing event; `openStep` stays `null` and `pendingCalls` empty while nothing is outstanding. A composed registry always serves the key, so clients read the value, never key presence.

## The fold

- `steps` counts `step/end` events — the loop appends exactly one per entered step, in a `finally`, so completed, failed, cancelled, and max-tokens steps all count.
- `turns` counts distinct turns carrying at least one closed step; rejected or empty turns are uncounted.
- `llmMs` sums `step/start` → `assistant/message` per step that assembled a message (in-step retry waits are model time).
- `ttftMs`/`ttftSteps` sum and count `step/start` → first non-empty delta chunk; the first attempt's boundary survives an in-step `llm/retry`.
- `decodeMs`/`decodeTokens` sum first token → assembled message and the provider-reported output tokens, only over steps carrying both.
- `toolMs` sums `tool/call` → `tool/result` pairs matched by callId; unresolved calls are dropped at `turn/end` (results land within their turn).
- `openStep` — the current open step (null when idle): its `turn`, `step`, `startTime`, and `firstTokenTime` (null before the first delta chunk).
- `pendingCalls` — dispatch times of tool calls whose result has not landed, keyed by callId; emptied wholesale at `turn/end`.

## Live monitoring

`openStep` and `pendingCalls` let an operator tell a long-but-healthy stream from a stuck step, read from the projection cache (`session_projcache.json`) or the `session/projection` change feed. The unit exposes them as plain fields; recovery decisions belong to the operator or an external monitor.

## Stall detection

The optional `stallThresholdMs` config arms a per-session timer on `step/start`; a step left open past the threshold logs one warning naming the session, turn, step, elapsed time, and threshold. The monitor is advisory only — it never cancels the step or changes scheduling.

Types: [SessionEvent](session.md) · [ProjectionDefinition](session-projection.md) · [SessionProjectionMap](session-projection.md)
