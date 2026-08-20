# Assess LLM-as-a-Verifier integration

English | [中文](2026-08-18_1932_assess-llm-verifier-integration.zh.md)

- Date: 2026-08-18 19:32 CST
- Session id: `01a01499-e19a-7441-9f32-ef8932f3e3f7`
- Project: DeepSeek Harness
- Workspace: `/Users/markus/deepseek-harness`
- Task: Evaluate how `llm-as-a-verifier/llm-as-a-verifier` should integrate with the local Harness project.
- Status: Completed
- Branch: `master` tracking `personal/master`

## User request summary

Inspect the external LLM-as-a-Verifier repository and recommend how to integrate it into the local DeepSeek Harness project.

## Work done

- Resolved the public upstream repository and inspected commit `115de305` from `main` using GitHub metadata and a source-only sparse clone.
- Read the upstream README, `pyproject.toml`, changelog, public Python APIs, logprob scoring implementation, progress tracker, prompt parser, tournament, and trajectory loaders.
- Compared the upstream requirements with the Harness LLM stream, agent lifecycle, durable session log, subprocess, workflow, subagent, and credentials capabilities.
- Attempted both native explorer and bounded external-worker reviews. The native explorer failed during service high demand; two external-worker reviews failed to produce an accepted structured result without changing files, so the main thread completed the bounded review from directly inspected evidence.

## Decisions

- Do not treat LLM-as-a-Verifier as a normal Harness LLM adapter: it consumes completed candidate trajectories and requires token-level top-logprobs, which the current provider-neutral `StreamChunk` does not expose.
- Prefer a new optional verifier capability whose first provider calls the pinned Python package through `ctx.subprocess` and an explicit JSON protocol.
- Keep candidate generation separate from scoring. Existing subagent/workflow capabilities should produce candidate sessions; a verifier consumer should format and rank them.
- Do not mount the provider in the base bundle until Python runtime acquisition and packaging are explicitly supported.
- Make the first consumer rank existing candidate session ids; add automatic best-of-N orchestration only after isolated candidate workspaces and winner promotion are defined.
- Default verifier failures to hard errors rather than upstream's neutral-tie fallback.

## Current state

- Upstream is MIT licensed, Python 3.9+, package `llm-verifier` version `0.2.0`, with `google-genai`, `openai`, and `tqdm` dependencies.
- Public operations are `select`, `compare`, `track`, and `ProgressTracker`; scoring depends on top-20 token logprobs and may issue many concurrent requests.
- Harness session events contain the information needed to build deterministic textual trajectories, but no Host-side verifier trajectory formatter currently exists.
- Product code is unchanged. The only local project changes are Codex session logs.
- Recommended package split: a verifier Service Definition, a Python `llm-verifier` subprocess provider, a deterministic Harness-session trajectory formatter, and a model-facing ranking Consumer. Online turn-stopping feedback is deferred.
- Main risks are missing logprobs in the existing LLM seam, Python distribution/runtime acquisition, upstream `.env` loading and 500-worker default, non-atomic JSON caches, lack of upstream tests, cost amplification, and candidate filesystem isolation/promotion.

## Resume instructions

1. Read this log, the upstream source under the recorded temporary clone if it still exists, and the final recommendation in this task.
2. Confirm the desired first user workflow: manual candidate ranking, automatic best-of-N subagents, or online progress feedback.
3. If implementation is authorized, create a scoped plan before adding packages and read `docs/defensive-patterns.md` for subprocess lifecycle requirements.
4. Start with a version-pinned Python bridge spike and a fake bridge test; do not begin by extending the general LLM stream protocol.

## Open questions

- Whether the first integration should be a user/model-invoked ranking tool or an automatic best-of-N workflow.
- Whether local development may require a dedicated Python virtual environment, or distribution must work in the bundled single-executable runtime.
