# Audit dsh-plugin-subscriptions

English | [中文](2026-08-18_1945_audit-subscriptions-plugin.zh.md)

- Date: 2026-08-18 19:45 CST
- Session id: `01a01499-e19a-7441-9f32-ef8932f3e3f7`
- Project: DeepSeek Harness
- Workspace: `/Users/markus/deepseek-harness`
- Task: Audit `V1ki/dsh-plugin-subscriptions` and assess integration with the local Harness project.
- Status: Completed
- Branch: `master` tracking `personal/master`

## User request summary

Read the external subscription-provider plugin, explain what it does, and determine whether and how it should be used with the local DeepSeek Harness checkout.

## Work done

- Inspected public repository `V1ki/dsh-plugin-subscriptions` at commit `a3ccede72f9d00739cead03dec5652f08a0e70ba` and npm package `dsh-plugin-subscriptions@0.3.1`.
- Read the manifests, bundle patches, OAuth flow, credential and model-cache stores, RPC and Web settings surfaces, Codex/Claude/Grok adapters, request translators, SSE parsers, tools, and unit tests.
- Compared the plugin's imported APIs with Harness releases `0.1.0-rc.5` through local `0.1.0-rc.7` and current workspace interfaces.
- Downloaded the signed npm tarball without running package scripts and checked its file inventory and runtime bundle for unexpected process-execution entry points.
- Loaded and mounted the published node bundle against the local workspace runtime in an isolated temporary `DSH_HOME`; it registered `claude`, `codex`, and `grok` without credentials or provider network calls.
- Inspected the open issue about Claude account bans and the open PR replacing stale hardcoded Claude Code identity fields.
- Attempted native and bounded external-worker reviews. Native workers failed during service high demand and the external worker timed out without changing files, so the main thread completed the read-only audit directly.
- Moved the temporary source clone, downloaded npm artifact, and isolated homes to the macOS Trash after the audit.

## Decisions

- Treat the plugin as an external optional plugin, not code to vendor into `packages/` or mount in default profiles.
- Do not describe it as free API access: it spends the user's existing ChatGPT, Claude, or Grok subscription allowance through OAuth-backed CLI/private endpoints.
- Do not install it for normal use yet. A trial should pin npm `0.3.1`, use an isolated `DSH_HOME`, enable only one provider, and run only one Harness process.
- Prefer Codex for a first experiment. Claude has the highest enforcement risk because the adapter explicitly presents as Claude Code with a hardcoded CLI version, identity prompt, beta flags, and broad OAuth scopes.
- Require upstream fixes or a local fork before broader use: inter-process credential locking/refresh ownership, narrow or justified scopes, independent tool enablement, provider replay-state support, and tests for OAuth/store/refresh behavior.

## Current state

- Product code and dependencies are unchanged; only Codex session metadata was added.
- The plugin is technically credible and follows current Harness extension points: self-activating bundle patch, `ctx.llm` adapters, optional `ctx.tools`, loopback-only Host RPC, Web settings client, and attachment integration.
- OAuth uses PKCE, random state, loopback callbacks, automatic refresh, and owner-only atomic credential-file replacement. Tokens remain plaintext in `~/.dsh/plugins/subscriptions/auth.json`.
- The credential store uses unlocked whole-file read/modify/write. Separate Web/headless processes can refresh the same rotating token concurrently; a permanent-error path can then delete another process's newly saved session.
- OAuth scopes exceed the plugin's used capabilities. Claude requests `org:create_api_key`, MCP-server, and file-upload scopes; Codex requests connector read/invoke scopes.
- Codex requests encrypted reasoning content but the translator does not persist or replay it. Both Responses and Anthropic translators explicitly omit reasoning blocks on subsequent requests.
- Enabling Grok or Codex automatically registers `x_search` or `image_generate`; there is no independent config switch for these tools.
- The repository is very new, has no GitHub Actions workflow or GitHub Release, and its authentication/store/refresh logic lacks dedicated tests. The npm package has a registry signature and integrity hash, while the corresponding Git commit is unsigned and npm metadata does not expose a `gitHead`.

## Verification

- `git diff --check` in the external clone: passed.
- Published-bundle import against local workspace packages: passed.
- Isolated mount smoke: registered `claude,codex,grok` and wrote no credential files.
- No dependency installation, source build, provider login, real credential read, or model/API request was performed.

## Resume instructions

1. Read this log and the final audit recommendation from the task.
2. If a trial is authorized, first decide which single provider to enable and create a separate `DSH_HOME`; do not share its auth store across Web and headless processes.
3. Pin the npm tarball integrity rather than installing from GitHub `main`.
4. Before normal use, fix the auth-store race and cross-process refresh coordination, add auth lifecycle tests, and add config switches for optional tools.
5. Re-check provider terms and current official CLI wire behavior at trial time; these private and CLI-gated endpoints can change without compatibility notice.

## Open questions

- Whether the user wants only a risk report, an isolated one-provider trial, or a hardened local fork.
- Which subscription account, if any, the user is willing to expose to an unofficial client.
