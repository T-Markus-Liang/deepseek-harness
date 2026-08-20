---
Date: 2026-08-20
Session id: 2026-08-20_1315-fix-stale-llm-openai-loader
Project: deepseek-harness
Workspace: /Users/markus/deepseek-harness
Task: Fix the stale llm-openai frontend loader failure on 127.0.0.1:3080
Status: completed
Branch: working tree
---

## User request

Fix the frontend error caused by the removed `llm-openai` plugin still being referenced by the running web profile.

## Work done

- Confirmed the repository packages for `llm-openai` and its client UI loader are removed.
- Removed the remaining generated pnpm metadata references from the external web profile by fixing its JSON and running `pnpm install --offline --ignore-scripts --frozen-lockfile`.
- Restarted `com.deepseek.dsh-web` with LaunchAgent `kickstart`; the new process is PID 3601.
- Confirmed the external web profile has no active `llm-openai` references or links.

## Current state

- PID 3601 is listening on `127.0.0.1:3080`.
- The root endpoint returns HTTP 200 and the boot manifest contains no `llm-openai` entry.
- The removed client script path returns HTTP 404.

## Resume instructions

No further action is required for this incident. Keep the removed FCC-derived package absent; future profile changes should be followed by a pnpm install so generated metadata stays synchronized.

## Open questions

None.
