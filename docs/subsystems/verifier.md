# Trajectory verifier

English | [中文](verifier.zh.md)

The verifier seam ranks complete candidate trajectories for one shared task. [`@deepseek-ai/dsh-verifier`](../../packages/verifier/verifier/README.md) defines the single `ctx.verifier` service, providers own scoring backends, and Consumers own how trajectories are collected and how a winner is used. The capability is opt-in and remains outside the agent loop.

The model-facing `verify_candidates` Consumer requires an agent-bound caller and accepts only durable Session headers whose cwd exactly matches the caller workspace. Missing and cross-workspace candidates produce the same model-facing error before any trajectory reaches the verifier provider.

Source: [`packages/verifier/verifier/src/types.ts`](../../packages/verifier/verifier/src/types.ts)

## Criteria and request

Each criterion has a stable label and concrete scoring guidance. A selection request carries complete serialized trajectories in caller-defined order plus all model, tournament, concurrency, and cancellation inputs; providers do not infer deployment defaults inside `select()`.

```ts type-equiv
/** One named evaluation criterion shown to the verifier. */
interface VerifierCriterion {
  /** Short criterion label. */
  readonly name: string
  /** Concrete scoring guidance. */
  readonly description: string
}
```

```ts type-equiv
/** Explicit best-of-N selection request. */
interface VerifierSelectRequest {
  /** Task all candidates attempted. */
  readonly problem: string
  /** Complete candidate trajectories in stable input order. */
  readonly candidates: readonly string[]
  /** Criteria evaluated independently by the verifier. */
  readonly criteria: readonly VerifierCriterion[]
  /** Verifier model identifier. */
  readonly model: string
  /** Repeated evaluations per criterion. */
  readonly nEvaluations: number
  /** Pivot count for the probabilistic pivot tournament. */
  readonly pivots: number
  /** Deterministic tournament seed. */
  readonly seed: number
  /** Maximum concurrent verifier calls. */
  readonly maxConcurrency: number
  /** Cancels the complete selection operation. */
  readonly signal?: AbortSignal
}
```

## Result and usage

Results use the request's candidate indices. `index` is the winner, `ranking` is best-first, and `scores` remains aligned to input order. Providers report their verifier API token usage separately from candidate generation.

```ts type-equiv
/** Verifier-reported token accounting for one selection. */
interface VerifierUsage {
  readonly calls: number
  readonly inputTokens: number
  readonly cachedInputTokens: number
  readonly uncachedInputTokens: number
  readonly outputTokens: number
  readonly reasoningTokens: number
}
```

```ts type-equiv
/** Validated selection result in input-candidate coordinates. */
interface VerifierSelection {
  /** Winning candidate index. */
  readonly index: number
  /** Per-candidate tournament scores. */
  readonly scores: readonly number[]
  /** Candidate indices sorted best-first. */
  readonly ranking: readonly number[]
  /** Directed tournament comparisons performed. */
  readonly comparisons: number
  /** Normalized criterion ids used by the upstream package. */
  readonly criteria: readonly string[]
  /** Verifier API token accounting. */
  readonly usage: VerifierUsage
}
```

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxverifier--verifier-abstract-seam"></a>

### `ctx.verifier` — `Verifier` (abstract seam)

Verifier capability implemented by an external scoring backend.

```ts cordis-catalog
/**
 * Rank complete trajectories for one task.
 * @param request - explicit candidates, criteria, model, tournament settings, and cancellation.
 * @returns the validated best-first selection.
 */
abstract select(request: VerifierSelectRequest): Promise<VerifierSelection>
```

Source: [`packages/verifier/verifier/src/index.ts:15`](../../packages/verifier/verifier/src/index.ts)
<!-- END GENERATED cordis-surface -->
