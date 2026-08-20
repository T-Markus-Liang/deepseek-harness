# Prepare isolated subscriptions Codex pilot

English | [中文](2026-08-18_2116_prepare-subscriptions-codex-pilot.zh.md)

- Date: 2026-08-18 21:16 CST
- Session id: `01a01499-e19a-7441-9f32-ef8932f3e3f7`
- Project: DeepSeek Harness
- Workspace: `/Users/markus/deepseek-harness`
- Task: Prepare a reproducible isolated Codex-only pilot for `dsh-plugin-subscriptions@0.3.1`.
- Status: Completed
- Branch: `master` tracking `personal/master`

## User request summary

Keep `V1ki/dsh-plugin-subscriptions` external, exclude it from `packages/` and default bundles, pin npm version `0.3.1` and lockfile integrity, use an independent `DSH_HOME` and a non-primary subscription account, enable only Codex, and permit only one DSH process for the credential directory. Defer broader use until cross-process locking, refresh ownership, tool switches, and authentication tests are fixed.

## Continues from

- `/Users/markus/deepseek-harness/docs/codex-sessions/completed/2026-08-18_1945_audit-subscriptions-plugin.md`

## Work done

- Confirmed npm metadata for `dsh-plugin-subscriptions@0.3.1`, including registry integrity `sha512-nIAqkZnNNZIq0WaUixtV0fVHmmuRCngX6xCyLs5yOlZOTwMWgMo3HcQRXspkcPffu2PZf57XbuImARgCamSyfA==`.
- Read the product profile installation and external bundle resolution rules.
- Ran the required external-worker health check; the worker runtime is healthy.
- The bounded read-only worker later timed out without file changes; the main thread completed the minimal profile work and did not replay the worker task.
- Created `/Users/markus/.dsh-subscriptions-codex-pilot` as an owner-only Harness home and installed exact dependency `dsh-plugin-subscriptions@0.3.1` into its `web` profile through the product `dsh plugin` command.
- Confirmed the isolated `pnpm-lock.yaml` records the expected registry integrity and that `pnpm install --frozen-lockfile` passes the package-manager supply-chain policy.
- Added a profile override with `providers: [codex]`; the composed config dump contains only that provider value.
- Added `/Users/markus/.dsh-subscriptions-codex-pilot/run-web.sh`, which uses an atomic owner directory to reject a second wrapper-owned DSH process and safely recovers a dead-owner lock.
- Added `/Users/markus/.dsh-subscriptions-codex-pilot/verify-pilot.mjs`, which parses the profile manifest, pnpm lockfile, and Cordis patch to assert the exact version, integrity, bundle list, and Codex-only runtime config.
- Added an external pilot README with the frozen restore command, non-primary-account rule, wrapper-only launch rule, and broader-use blockers.
- Built the existing `@deepseek-ai/dsh-client-ui-workbench` artifacts needed by the current local Web bundle without editing its source.
- Started the isolated Web profile at `http://127.0.0.1:3081` through the lock-owning wrapper.
- Opened the local Settings > Subscriptions page without starting OAuth. No `auth.json` exists.
- Found that version 0.3.1 does not filter its Settings cards or `/subscriptions-auth` RPC by configured providers: Claude and Grok login remains available even though only the Codex LLM adapter is registered.
- Verification results:
  - structured pilot verifier: passed;
  - frozen pnpm install and supply-chain policy: passed;
  - composed config dump: `providers: [codex]`;
  - active-owner lock rejection and stale-owner recovery: passed;
  - local Web mount and Subscriptions settings render: passed;
  - `git diff --check`: passed;
  - the two changed bilingual pairs: passed;
  - `pnpm run doc-sync`: 27 of 28 gates passed; the corpus-wide translation gate is blocked by a concurrently added, task-external Agent Note missing its `.i18n.yaml` record;
  - `pnpm run lint`: blocked only by four task-external Host findings in `packages/host/apiproxy`;
  - repository `packages/` and default bundles contain no subscriptions integration.

## Decisions

- Keep the pilot outside repository packages and shipped bundle manifests.
- Do not perform OAuth login or inspect the primary Harness home during preparation.
- Use a dedicated Harness home, Codex-only configuration, and a single-process launcher.
- Treat Codex-only as an adapter configuration in version 0.3.1, not an authentication authorization rule; the user must not click the visible Claude or Grok login controls.
- Keep `image_generate` unused because version 0.3.1 couples it to the Codex provider and provides no independent switch.

## Current state

- The isolated server is listening on `http://127.0.0.1:3081`; it has no subscription credentials.
- The pilot is ready for the user to authorize Codex manually with a non-primary account.
- Broader use remains blocked on provider-filtered authentication, cross-process store locking, refresh ownership, independent tool switches, and authentication/store/refresh tests.
- Existing verifier integration changes remain untouched in the dirty worktree.

## Resume instructions

1. Read this log, the completed subscriptions audit, and `/Users/markus/.dsh-subscriptions-codex-pilot/README.md`.
2. Run `/Users/markus/.dsh-subscriptions-codex-pilot/verify-pilot.mjs` before restarting or restoring dependencies.
3. Start only through `run-web.sh` and never run another DSH process against this home.
4. Authorize only Codex with a non-primary account; do not use Claude, Grok, or `image_generate`.
5. Keep the listed hardening work separate and complete it before broader deployment.

## Open questions

- The user must complete the Codex OAuth authorization because it transmits account credentials and grants persistent access.
