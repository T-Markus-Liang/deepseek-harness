---
Date: 2026-08-20
Session id: 2026-08-20_1240_remove-fcc-llm-module
Project: deepseek-harness
Workspace: /Users/markus/deepseek-harness
Task: Remove the unused FCC-derived LLM module
Status: completed
Branch: working tree
---

## User request

Remove the local FCC-derived `llm-openai` module because it is not useful for the current deployment.

## Work done

- Removed the runtime package `packages/llm/llm-openai`.
- Removed its companion settings UI `packages/client/ui-settings-llm-openai`.
- Removed workspace references from `tsconfig.client.json`, `tsconfig.host.json`, `packages/bundle/web-app/package.json`, and `packages/bundle/web-app/cordis.patch.yml`.
- Removed the module from the web profile package and patch at `/Users/markus/.dsh/profiles/web`.
- Regenerated the root and web-profile lockfiles.
- Moved the removed package directories and their proposed architecture notes to `/tmp/dsh-removed-fcc-module-20260820` as a recoverable trash location.
- Restarted `com.deepseek.dsh-web`; 3080 continues to return HTTP 200.

## Verification

- No remaining active source, workspace, lockfile, or web-profile references to `llm-openai` or `dsh-llm-openai`.
- `git diff --check` passed.
- `lsof` shows the managed web process listening on 127.0.0.1:3080; root probe returned HTTP 200 and 16,661 bytes.
- `pnpm run typecheck` reached the existing host contract checks but failed on unrelated pre-existing `WorkspaceApi` test mocks missing `deleteSession` and `moveSession`.

## Current state

The FCC-derived module is no longer part of the repository workspace or web profile. `dsh-llm-pi-ai` and `dsh-llm-fallbacks` remain unchanged.

## Resume instructions

Use `rg -n "llm-openai|dsh-llm-openai"` over active source/config if future cleanup is needed. The recoverable removed files are under `/tmp/dsh-removed-fcc-module-20260820`.

## Open questions

None for this removal.
