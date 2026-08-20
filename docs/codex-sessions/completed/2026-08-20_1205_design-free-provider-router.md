---
Date: 2026-08-20
Session id: 2026-08-20_1205_design-free-provider-router
Project: deepseek-harness
Workspace: /Users/markus/deepseek-harness
Task: Design the FCC-derived free-provider router upgrade
Status: completed
Branch: working tree
---

## User request

Assess how to evolve the FCC-derived local provider adapter into a plugin focused on lawful free-provider usage and automatic quota-aware routing.

## Evidence reviewed

- Local adapter package: `packages/llm/llm-openai/src/`
- Local settings UI: `packages/client/ui-settings-llm-openai/src/`
- DSH LLM seam and retry behavior: `packages/llm/llm/src/` and `packages/llm/llm-retry/src/`
- Installed `dsh-llm-fallbacks` documentation
- Upstream FCC README and source for provider catalog, provider admission, runtime factory, OpenAI connected-account auth, model catalog, and fallback behavior

## Findings

- The local plugin currently has a static catalog and direct OpenAI Chat Completions transport, but no free/paid classification, quota ledger, provider admission controller, quota-aware selection, account rotation, or provider-specific auth.
- It translates upstream token usage into DSH chunks but does not persist usage or infer remaining daily quota.
- `dsh-llm-fallbacks` handles failure-based switching, not quota accounting or free-route selection.
- FCC itself supplies useful patterns for admission, concurrency, retries, special provider factories, connected accounts, and model fallback; exact free quota remains provider-specific and often cannot be measured without an upstream quota API.

## Recommended upgrade

1. Add a provider eligibility catalog with `freeEligible`, auth kind, capability requirements, reset policy, and terms/source metadata. Default to only explicitly marked ToS-friendly free routes; never auto-create accounts or bypass limits.
2. Add a durable quota/health ledger under the DSH home with interprocess locking, reset timestamps, reservations, observed usage, 401/403/402/429 handling, Retry-After cooldowns, and an unknown-quota state that is conservative rather than optimistic.
3. Add a quota-aware router that scores eligible routes by remaining budget, cooldown, health, capability match, and priority. Reserve before dispatch and settle from actual usage after the stream. Keep `dsh-llm-fallbacks` for final failure fallback rather than duplicating its turn-recovery behavior.
4. Start with OpenAI-compatible routes only. Add provider-specific FCC adapters and connected-account/OAuth routes in later stages; subscription routes must remain opt-in and clearly separated from free routes.
5. Add a virtual `free-pool` model/provider plus web diagnostics showing configured, eligible, cooldown, estimated remaining, and unknown states without exposing credentials.

## Naming

The current `llm-openai` name is inaccurate. After the router exists, use `@deepseek-ai/dsh-llm-fcc-free` / `llm-fcc-free` (or an equivalent FCC-derived free-router name), not `llm-openai`. Avoid `free-claude-code` because this local package is not the full FCC proxy or OAuth implementation.

## Open questions

Exact provider quota APIs, reset windows, and account policies must be verified per provider before enabling automatic quota estimates. The first implementation should use conservative health/cooldown routing and only claim exact quotas where the provider exposes authoritative data.
