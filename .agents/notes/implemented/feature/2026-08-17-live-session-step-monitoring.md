# Agent Note: Live step state exposed for stall monitoring

Status: implemented

English | [中文](2026-08-17-live-session-step-monitoring.zh.md)

## Problem

The sessionStats projection has always folded the in-flight step boundaries its figures accrue from — the open step (turn, step, startTime, firstTokenTime) and the pending tool calls (callId to dispatch time) — but its view returned only the completed totals, so the persisted projection cache carried none of that live state. An operator watching `session_projcache.json` could see that a session had recorded turns and steps but could not tell whether a step was currently open, how long it had been running, or which tool calls were outstanding. Stall detection therefore had no data source: nothing outside the loop could distinguish a long but healthy LLM stream from a stuck step.

The existing protections stay at their own boundaries: `streamIdleTimeoutMs` bounds the transport while the iterator is outstanding, and the tool timeout policy bounds a single tool call. No mechanism observes the whole open step.

## Decision

The sessionStats view now exposes the live state it already folds: `openStep` (null when idle) and `pendingCalls` (empty when nothing is outstanding). The projection cache persists the unit's view, and every carrier reads that state through the view, so both fields land in `session_projcache.json` and the projection change feed. `stateVersion` moves to 2 because the stored row shape changed: rows written before the view change lack the two new fields, and a version mismatch discards them at cold read instead of serving a row the schema no longer admits.

The plugin gains one optional config, `stallThresholdMs`. When set to a positive value, a process-local timer per open step logs a warning once a step exceeds the threshold, naming the session, turn, step, elapsed milliseconds, and threshold. The timer is cleared when the step closes or the turn ends, and a new `step/start` replaces the previous step's timer. Omitted or 0 disables detection, matching the shipped compositions, which mount the plugin with no config. The schemastery schema validates the value as a non-negative integer, so a malformed threshold fails load instead of silently disabling detection.

The monitor is observational only: it emits a warning and never cancels work, mutates session data, or changes scheduling. The operator, model, or an external monitor decides whether to intervene, using the same data the projection cache already exposes.

## Alternatives considered

**Add a step deadline in the agent loop.** Rejected because the loop already rejects its own cancellation semantics, and an automatic step timeout could discard a long but legitimate model stream; the transport idle watchdog already bounds the pathological case.

**Emit a typed event instead of a log line.** Deferred because the projection cache is already the durable carrier for live state, and no consumer yet needs a distinct stall event stream; the log line keeps the first iteration single-purpose.

## Consequences

Existing deployments see additive fields in the sessionStats view; nothing they read breaks, and rows already cached are discarded on version mismatch and recomputed from the log on the next cold read. The optional config changes no shipped composition. Each open step yields at most one warning per activation of the timer — a step that stays open past the threshold is not re-warned until a later step starts.
