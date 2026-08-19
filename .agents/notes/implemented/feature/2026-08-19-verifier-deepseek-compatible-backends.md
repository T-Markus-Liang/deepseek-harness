# Agent Note: DeepSeek-compatible verifier backends behind the pinned bridge

Status: implemented

English | [中文](2026-08-19-verifier-deepseek-compatible-backends.zh.md)

## Problem

`llm-verifier` scores candidates from token-level top-20 logprobs returned by its verifier backend. Aggregator and relay endpoints commonly reject the `logprobs` parameter (SenseNova, Kimi, Ark Coding Plan) or accept it without returning data (cmd-code), so none of them can drive selection. A local `morecode` shim passes requests through to a DeepSeek-semantics upstream (1314mc.net) whose `deepseek-v4-flash` model does return real per-token logprobs, but the shim address contains no `api.deepseek.com`, so upstream never tags the client as DeepSeek. Scoring then enters the vLLM/SGLang prefill branch (`_score_tags_by_prefill`), which a DeepSeek-compatible server cannot satisfy, and every selection silently degrades to the 0.5 neutral tie with zero recorded usage.

## Decision

Add three deployment-facing `Config` fields to `dsh-verifier-python`, extending the verifier-capability family decision ([llm-verifier-best-of-n](2026-08-18-llm-verifier-best-of-n.md)): `deepseekCompatible` (defaults to false), `maxTokens` (defaults to 8192), and `effort` (defaults to `off`). When `deepseekCompatible` is true the provider forwards `LLM_VERIFIER_DEEPSEEK_COMPATIBLE=1`, `DEEPSEEK_MAX_TOKENS`, and `DEEPSEEK_EFFORT` into the bridge process environment. The embedded bridge then tags every client built for the configured endpoint with `_llm_verifier_deepseek` by replacing `fine_grained_reward.create_openai_client`, routing scoring through the DeepSeek call path where the model emits its own score tags and token-level logprobs. The official DeepSeek API needs none of this: its base URL already triggers the upstream tag, and the default false leaves the previous behavior untouched.

A DeepSeek-family reasoning model consumes output budget before answering, so the defaults pair a bounded `DEEPSEEK_MAX_TOKENS` (8192) with `DEEPSEEK_EFFORT=off`; an 2048-token budget was consumed entirely by reasoning and raising, while the upstream 32768 default made calls hang. The credential reference must target the OpenAI-compatible variable: upstream reads `OPENAI_API_KEY` (falling back to `DEEPSEEK_API_KEY`) when an OpenAI base URL is configured, so a deployment like the `morecode` shim configures `credentialRef: MORECODE_API_KEY` and `credentialEnv: OPENAI_API_KEY`.

## Testing

Fake bridge tests assert the three environment variables are forwarded only when `deepseekCompatible` is configured, with `credentialEnv` targeting `OPENAI_API_KEY`, and that the production bridge embeds both the `LLM_VERIFIER_DEEPSEEK_COMPATIBLE` switch and the `_llm_verifier_deepseek` tag. A real run of the exported bridge against the `morecode` shim with `deepseek-v4-flash` selects the correct candidate from a three-candidate reversed-string problem with differentiated scores and recorded usage, including nonzero cached tokens.

## Alternatives considered

- **Patch upstream to tag arbitrary base URLs as DeepSeek** — rejected because the release cadence is not under harness control; the embedded bridge keeps the pinned version closed and self-consistent, and deployments can still override `bridgePath`.
- **Approximate logprobs by resampling** — rejected because frequency estimates are not the model's true distribution and would invalidate the score expectation the verifier is built on.
- **Run a local vLLM-style server** — rejected as deployment-owned and currently without a GPU host in this environment.

## Consequences

- DeepSeek-semantics relay endpoints (like this environment's `morecode` shim) work out of the box with three configuration values.
- Official DeepSeek deployments are unaffected because the default stays false.
- The provider contract now distinguishes OpenAI-compatible relay behavior from DeepSeek-compatible relay behavior; opting in wrongly (labeling a non-DeepSeek endpoint) surfaces as bridge errors from the DeepSeek call path.

## Known limitations and deferred work

- The tag applies to every client built in the bridge process, so a deployment cannot mix an OpenAI-semantics endpoint and a DeepSeek-semantics endpoint in one provider instance.
- `DEEPSEEK_EFFORT` and `DEEPSEEK_MAX_TOKENS` only influence the DeepSeek call path; other backends ignore them.
- The reasoning-quality trade-off of raising `effort` (and the output budget with it) has not been measured on this endpoint.