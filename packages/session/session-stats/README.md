# @deepseek-ai/dsh-session-stats

English | [中文](README.zh.md)

Function plugin registering the `sessionStats` projection unit: whole-log conversation figures — turn/step counts and the LLM, tool, first-token, and decode wall times — folded from step boundaries, stream chunks, tool pairs, and assembled assistant messages, and served through the session-projection seam (registry snapshot, change feed, and every projection carrier: history tail page, `session/projection` push frames, session list rows). Clients render full-session figures that paging and compaction cannot change; the reference consumer is the web chat stats strip, whose window fold mirrors these field names as its no-unit fallback.

## Fold semantics

- `steps` counts `step/end` events. The agent loop appends exactly one per entered step, in a `finally`, so completed, failed, cancelled, and max-tokens steps all count. Counting assembled assistant messages instead would overcount max-tokens usage-host messages (empty content, excluded from the surface) and undercount cancelled steps (aborted before the message assembles).
- `turns` counts distinct turns carrying at least one closed step; rejected or empty turns (closed with no step) are uncounted. Turn numbers are host-assigned and monotonic per session, so the fold keeps only the last counted turn.
- `llmMs` sums `step/start` → `assistant/message` per step that assembled a message (retry waits inside the step are model time, as in the window fold).
- `ttftMs`/`ttftSteps` sum and count `step/start` → first non-empty delta chunk; the first attempt's boundary survives an in-step `llm/retry` (window `resetForRetry` parity).
- `decodeMs`/`decodeTokens` sum first token → assembled message and the provider-reported output tokens, only over steps carrying both.
- `toolMs` sums `tool/call` → `tool/result` pairs matched by callId; unresolved calls are dropped at `turn/end` (results land within their turn).
- `openStep` — current open step (null when idle), exposed live for external monitoring via `session_projcache.json`. Contains `turn`, `step`, `startTime`, and `firstTokenTime` (null before first delta chunk).
- `pendingCalls` — dispatch times of tool calls whose result has not yet landed, keyed by callId. Empty when idle or all results have settled.
- Every figure is 0 until its first contributing event; `openStep` stays `null` and `pendingCalls` empty while nothing is outstanding. A composed registry always serves the key, so clients read the value, never key presence.

## Config

### `stallThresholdMs`

Optional step stall detection threshold in milliseconds. When set, the plugin monitors each open step's duration and warns when a step exceeds this threshold. Disabled by default.

```yaml
- id: session-stats
  name: '@deepseek-ai/dsh-session-stats'
  config:
    stallThresholdMs: 300000
```

## Live monitoring

The view carries the live open step and in-flight tool calls so an operator can tell a long-but-healthy stream from a stuck step. Read them from the projection cache (`~/.dsh/storages/session_projcache.json`) or the `session/projection` change feed:

```json
{
  "sessionStats": {
    "openStep": { "turn": 9, "step": 11, "startTime": 1725000000000, "firstTokenTime": 1725000001000 },
    "pendingCalls": { "call_1": 1725000001200 }
  }
}
```

- `openStep` — `null` when idle; otherwise the in-flight step with its `startTime` and `firstTokenTime` (null before the first delta chunk).
- `pendingCalls` — dispatch times (epoch ms) of tool calls whose result has not landed, keyed by callId.

### Stall detection

With `stallThresholdMs` set, a step left open past the threshold logs one warning naming the session, turn, step, elapsed time, and threshold:

```
session "…": step stall — turn 9 step 11 has run 300123ms (threshold 300000ms)
```

The monitor is advisory only: it never cancels the step or changes scheduling. Recovery decisions belong to the operator or an external monitor, which reads the same projection data.

## Composition

```yaml
- id: session-stats
  name: '@deepseek-ai/dsh-session-stats'
```

Injects `sessionProjections` — the plugin's whole purpose; in assemblies without the registry the fiber stays pending and nothing registers.

## Model Experience

None, as the plugin only computes a client-facing read model of already-logged session events and touches no prompt, message, schema, stream, or tool result.

#### KV Cache effect

None; the plugin never assembles or sends provider requests.

## Known Limitations and Deferred Work

- **Steps count work attempted, not visible output** — a step that failed before producing any visible content still closed with `step/end` and counts; a step interrupted by a crash counts after the session reloads, when crash recovery appends its synthetic `step/end` (`interruptedTurnClosers` in dsh-session).
- **A cancelled step is counted but untimed** — no assistant message assembles, so its partial stream time enters no wall-time figure, matching the window fold's untimed interrupted node; a max-tokens usage-host message conversely contributes model time the surface does not show.
- **Counts are log-scoped, not surface-scoped** — steps whose messages were later compacted away stay counted; the figures describe the whole session, not the current model-visible surface.
- **Mounted only in the web-app bundle** — other assemblies serve no `sessionStats` key, and their consumers fall back to window-scoped counting (the web stats strip's fallback path).
- **Step stall detection is best-effort** — may false-positive or false-negative due to event dispatch timing. Does not alter model behavior or cancel requests; only emits warning logs.
