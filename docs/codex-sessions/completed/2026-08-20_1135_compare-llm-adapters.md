---
Date: 2026-08-20
Session id: 2026-08-20_1135_compare-llm-adapters
Project: deepseek-harness
Workspace: /Users/markus/deepseek-harness
Task: Compare dsh-llm-pi-ai with local llm-openai
Status: completed
Branch: working tree
---

## User request

Verify whether `dsh-llm-pi-ai` and the local `llm-openai` plugin provide the same functionality.

## Work done

- Compared both package manifests, plugin entrypoints, configuration schemas, adapters, catalogs, README contracts, and test coverage.
- Counted provider catalogs from the built/local sources: `llm-openai` has 35 static routes; installed pi-ai exposes 37 routes.
- Found only one exact route-id collision: `fireworks`; `opencode-go` is also active in the web profile's pi-ai settings.
- Confirmed the web profile's allowlist excludes those overlapping routes from `llm-openai`.

## Conclusion

The plugins overlap at the LLM adapter seam and both can speak OpenAI Chat Completions, but they are not equivalent. `llm-pi-ai` is the primary generic adapter: it uses pi-ai's provider/model catalog and supports multiple protocols, dynamic profile resolution, reasoning/compatibility controls, model discovery, snapshots, attachment handling, and provider-native behavior. `llm-openai` is a lighter direct-fetch adapter with a separate static catalog of mostly OpenAI-compatible Chat Completions endpoints and fewer controls.

## Resume instructions

Read `packages/llm/llm-pi-ai/src/index.ts`, `packages/llm/llm-pi-ai/src/config.ts`, `packages/llm/llm-pi-ai/src/catalog.ts`, `packages/llm/llm-openai/src/index.ts`, and `packages/llm/llm-openai/src/adapter.ts` before changing provider composition.

## Open questions

Decide later whether the direct adapter's unique routes justify keeping a second provider family, or whether those routes should be migrated into pi-ai profiles/catalog contributions.
