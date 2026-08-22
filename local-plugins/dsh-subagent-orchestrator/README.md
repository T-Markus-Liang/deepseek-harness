# DSH Subagent Orchestrator

`dsh-subagent-orchestrator` makes subagent model policy deterministic in DeepSeek Harness.

It owns four explicit delegation tools:

| Tool | Route | Purpose |
|---|---|---|
| `orchestrate_subagent` | SenseNova / DeepSeek V4 Flash | Low-cost fresh child |
| `orchestrate_fork` | SenseNova / DeepSeek V4 Flash | Inherited-context child without inheriting the parent model |
| `orchestrate_reviewer` | Qilin Review / GPT-5.6 Terra | Code and security review quality exception |
| `orchestrate_visual` | Command Code / DeepSeek V4 Visual Flash Exp | Image understanding |

Each tool passes explicit `agentOptions` to the DSH subagent provider. This overrides the delegating parent's creation-time provider/model, eliminating accidental inheritance of an expensive root model.

## Installation

Add the package to the Web profile dependencies and `dsh.profile.bundles`, then rebuild the profile dependencies and restart `dsh web`.

The package bundle adds namespaced tools alongside the base DSH tools. It does not disable or alter existing `subagent` and `subagent_fork` entries.

## Configuration

The Web card is available in **Settings → Plugins → Subagent Orchestrator**.

- `Economy` is the supported initial policy.
- `Balanced` and `Quality` are visible future presets. They currently retain the editable routes; they do not silently introduce paid models.
- Advanced configuration changes the provider, model, and token cap for the normal, reviewer, and visual routes.
- The card records migration confirmation only. It never silently edits `fallbacks.roles` or `rootChain`.

Default routes:

```text
orchestrate_subagent / orchestrate_fork
  sensenova/deepseek-v4-flash, 8192 tokens

orchestrate_reviewer
  qilin-review/gpt-5.6-terra, 16384 tokens

orchestrate_visual
  coding-plan/deepseek-v4-visual-flash-exp, 8192 tokens
```

Provider fallback remains the responsibility of `dsh-llm-fallbacks`. Configure its root chain separately. During migration, remove only legacy subagent role injection after verifying the new explicit tools; do not remove `rootChain`.

## Migration

The card exposes a confirmation for legacy `fallbacks.roles` migration. Confirmation is intentionally non-destructive in 0.1.0: it writes only `migrationAccepted: true` in this plugin namespace.

After confirmation and route verification, remove `fallbacks.roles` manually from `~/.dsh/settings.yaml`. Keep `fallbacks.enabled` and `fallbacks.rootChain` for root-agent fallback.

## Visual Integration

Command Code DeepSeek V4 Visual Flash Exp is the primary visual path and declares native image input support. `dsh-image-text-bridge` remains an optional separate package for converting image requests sent to text-only routes. This package does not install, configure, or modify the bridge.

## Verification

```sh
npm test
npm run check
npm pack --dry-run
```

Runtime acceptance:

1. Start `orchestrate_subagent` from a session created on a non-Flash model; inspect its `request/context` and confirm `sensenova/deepseek-v4-flash`.
2. Repeat with `orchestrate_fork`; it must still be Flash.
3. Start `orchestrate_reviewer`; confirm `qilin-review/gpt-5.6-terra`.
4. Start `orchestrate_visual`; confirm `coding-plan/deepseek-v4-visual-flash-exp` and verify an image input is accepted.
5. Verify the Web card renders and persists an advanced route override.
