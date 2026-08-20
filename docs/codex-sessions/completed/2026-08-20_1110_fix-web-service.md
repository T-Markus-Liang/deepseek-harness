---
Date: 2026-08-20
Session id: 2026-08-20_1110_fix-web-service
Project: deepseek-harness
Workspace: /Users/markus/deepseek-harness
Task: Restore the local web service on 127.0.0.1:3080
Status: completed
Branch: working tree
---

## User request

Restore the local DSH web frontend at `http://127.0.0.1:3080/` without reverting existing user work.

## Work done

- Confirmed the initial failure was a configurable-provider collision while loading the web profile.
- Updated `/Users/markus/.dsh/profiles/web/cordis.patch.yml` so the local `llm-openai` plugin uses an explicit allowlist that excludes routes already declared by `llm-pi-ai` (`fireworks` and `opencode-go`).
- Verified a clean boot on port 3082 and restarted the managed `com.deepseek.dsh-web` LaunchAgent with `launchctl kickstart`.
- Verified PID 34764 listens on 127.0.0.1:3080 and the root endpoint returns HTTP 200 with 16,661 bytes.

## Decisions

- Kept the user-developed `packages/llm/llm-openai` package and all unrelated dirty worktree changes intact.
- Scoped the fix to the machine-local web profile rather than changing shared provider registration behavior.

## Current state

The web service is running under `com.deepseek.dsh-web` and is reachable at `http://127.0.0.1:3080/`.

## Resume instructions

Read `/Users/markus/.dsh/profiles/web/cordis.patch.yml`, then inspect `/tmp/dsh-web.log` and run `lsof -nP -iTCP:3080 -sTCP:LISTEN` plus a root `curl` probe before making further changes.

## Open questions

None for the requested restart. The provider allowlist should be revisited if additional `llm-pi-ai` routes are added to `/Users/markus/.dsh/settings.yaml`.
