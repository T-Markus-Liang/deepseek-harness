# 轨迹 Verifier

[English](verifier.md) | 中文

Verifier seam 为同一个任务的完整候选轨迹排名。[`@deepseek-ai/dsh-verifier`](../../packages/verifier/verifier/README.md) 定义唯一的 `ctx.verifier` 服务，provider 拥有评分后端，Consumer 决定如何收集轨迹以及如何使用胜者。该能力为 opt-in，并保持在 agent loop 之外。

面向模型的 `verify_candidates` Consumer 要求调用方绑定 agent，并且只接受 cwd 与调用方工作区完全相同的持久化 Session header。缺失和跨工作区候选会在任何轨迹抵达 verifier provider 之前产生相同的模型侧错误。

来源：[`packages/verifier/verifier/src/types.ts`](../../packages/verifier/verifier/src/types.ts)

## 标准与请求

每项标准都有稳定标签和具体评分指引。Selection 请求按调用方定义的顺序携带完整序列化轨迹，以及全部 model、tournament、concurrency 和 cancellation 输入；provider 不会在 `select()` 内推断部署默认值。

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

## 结果与用量

结果使用请求中的候选索引。`index` 表示胜者，`ranking` 按从优到劣排列，`scores` 与输入顺序保持对齐。Provider 单独报告 verifier API token 用量，不与候选生成用量混合。

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
