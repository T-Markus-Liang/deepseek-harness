# Agent Note: Pinned trajectory verifier and isolated best-of-N

Status: implemented

English | [中文](2026-08-18-llm-verifier-best-of-n.zh.md)

## Problem

The harness could generate child Sessions and run general workflows, but it had no independent evaluator for ranking complete candidate trajectories. Integrating `llm-as-a-verifier` as an `LlmAdapter` would be incorrect: selection consumes multiple complete trajectories and requires token-level log probabilities from its own verifier backend. Calling its Python API directly from a model-facing tool would also mix process safety, credentials, Session projection, and candidate orchestration in one plugin.

Automatic best-of-N adds another requirement. Candidates that can edit files must not race in one working tree, and a detached Git worktree begins at committed `HEAD`, not at arbitrary dirty local state. Winner promotion therefore needs an explicit clean-parent precondition and a recheck before applying any patch.

## Decision

Add a verifier capability family with four packages. `dsh-verifier` defines `ctx.verifier.select()`. `dsh-verifier-python` implements it through one versioned JSON request per subprocess. `dsh-tool-verify-candidates` projects existing durable Sessions and ranks them. `dsh-tool-best-of-n` is a fixed generation, evaluation, and promotion Consumer over subagents, Git worktrees, and the verifier.

The Python provider pins upstream commit `115de305f23ed89bc42e86e010853c40059f3f7d` through released package version `llm-verifier==0.2.0`. The exported `LLM_VERIFIER_REQUIREMENT` and the embedded bridge's `PACKAGE_VERSION` require that exact version. Every operation has a private cwd, bounded stdout/stderr, an explicit credential reference, conservative concurrency, `on_error="raise"`, no cache file, and no progress stream. The subprocess base strips ambient credentials; because the private cwd contains no project `.env`, upstream dotenv discovery cannot acquire project secrets. Cancellation waits for the complete child process tree to exit.

`verify_candidates` accepts Session ids instead of raw trajectories. It requires an agent-bound caller and accepts only inspected Session headers whose cwd exactly matches the caller workspace; missing and cross-workspace ids fail with the same model-facing error before verifier dispatch. It reconstructs the canonical current message surface through `Session.deriveMessages()`. Log-only events and shadowed surface nodes are excluded. Trajectories over the configured bound fail rather than being truncated, and verifier indices are mapped back to the caller's stable Session-id order.

For automatic generation, one-shot `SubagentStartRequest` gains the optional `workspaceCwd` capability. The service accepts only absolute paths and rejects a provider that does not advertise support. In-process spawn and fork providers apply the override to the child Session header; ordinary delegation exposes no model path argument and out-of-process providers retain deployment-owned cwd behavior.

`best_of_n` requires a clean Git parent and records its `HEAD`. It creates detached worktrees sequentially, starts candidates concurrently only after all worktrees exist, waits for every startup and result, ranks complete local child Sessions, stages the winner inside its private worktree, extracts a binary patch relative to the recorded base, and rechecks the parent `HEAD` and status. Only then does it apply the patch. Normal completion removes every worktree. A patch extraction or promotion failure preserves the winning worktree and reports its path; partial creation cleans only paths that were actually created.

All verifier packages remain opt-in and no default bundle changes. Online progress injection through `agent/turn-stopping` is deferred until bridge, Session ranking, and isolated generation behavior have operational evidence.

## Testing

Fake bridge tests start real managed subprocesses and cover request fields, single-candidate selection, explicit credentials with ambient-secret stripping, cancellation to process exit, missing credentials, stdout and stderr overflow, malformed responses, inconsistent rankings, and exact package pinning. Tool tests prove caller-workspace authorization, canonical Session-surface projection, and Session-id mapping. A real temporary Git repository test proves isolated worktree generation, winner-only patch promotion, cleanup, and dirty-parent rejection. Subagent tests prove capability gating and absolute-path validation. Real Loader tests boot both Consumers from YAML, and a keyless assembled snapshot exposes both schemas while ranking two durable Sessions through a deterministic verifier.

## Alternatives considered

- **Implement selection as an LLM adapter** — rejected because adapter requests represent one conversation generation, not comparison of several complete trajectories with verifier-specific logprob semantics.
- **Pass raw trajectories through the tool** — rejected because durable Session ids avoid duplicate model-controlled payloads and let the harness own exact transcript reconstruction.
- **Extend the general workflow scripting language with verifier and isolation hooks** — rejected because the fixed coding workflow needs Git cleanliness, patch promotion, and recovery rules that do not belong to every workflow script.
- **Copy the current directory for each candidate** — rejected because ad hoc copies lose Git identity and make patch extraction and cleanup ambiguous. Detached worktrees provide a precise shared base.
- **Allow a dirty parent and merge afterward** — rejected because uncommitted and untracked state cannot be reproduced or conflict-checked as one authoritative base without a separately designed snapshot protocol.

## Consequences

- Complete-trajectory evaluation is a replaceable capability rather than provider-specific tool code.
- Existing Sessions can be ranked without regenerating candidates.
- Automatic candidates have independent filesystem edits and only the winning patch reaches the parent.
- The subagent seam can express an isolated cwd without exposing it on ordinary model delegation.
- Deployments must provision Python with `llm-verifier==0.2.0`, configure one credential reference, and opt in to the desired tools.

## Known limitations and deferred work

- Worktrees isolate edits, not authority: candidate processes still share Git metadata and whatever external access deployment policy permits.
- Winner promotion produces uncommitted parent changes. Commit creation, three-way conflict handling, and dirty-parent snapshotting remain separate policies.
- The initial bridge does not expose upstream image inputs, comparison, progress tracking, or cache reuse.
- Out-of-process subagent providers do not yet accept per-run workspace paths.
- Verifier phase progress is not injected through `agent/turn-stopping`; that integration remains intentionally deferred.
