# @deepseek-ai/dsh-tool-verify-candidates

English | [中文](README.zh.md)

The opt-in `verify_candidates` tool ranks existing durable Sessions in the calling agent's workspace. The model supplies the shared problem, distinct Session ids, criteria, and an optional deterministic seed. Deployment config owns model, evaluation count, pivots, verifier concurrency, candidate count, and trajectory size limits.

The tool requires an agent-bound caller with a workspace cwd. For each id, it calls `sessionPersistence.inspect()`, rejects a missing or cross-workspace header with one indistinguishable model-facing error, and rebuilds the current model-visible message surface through the canonical `Session.deriveMessages()` rules. Log-only chunks, lifecycle records, and shadowed surface nodes never enter the verifier trajectory. Oversized trajectories fail instead of being truncated. The result maps scores and ranking back to the original Session ids.

## Model Experience

### Tool schema and result

#### What the model sees

The generated [`verify_candidates` schema](../../../docs/tool-catalog.md#deepseek-aidsh-tool-verify-candidates) accepts the shared problem, Session ids, criteria, and optional seed. The result contains `winnerSessionId`, complete Session-id ranking, scores, comparisons, and verifier token usage.

#### Token effect

The schema adds a small fixed request cost. The retained result grows with candidate count, while complete candidate trajectories stay outside the parent conversation.

#### KV Cache effect

Tool visibility is prefix-stable while composition is unchanged. The result appends after the reusable parent prefix.

## Known Limitations and Deferred Work

- Every candidate must already be visible to the configured Session persistence provider and carry the calling agent's exact workspace cwd.
- The task description and criteria are explicit tool inputs; they are not inferred from candidate logs.
- Image attachments are not projected in this first integration.
