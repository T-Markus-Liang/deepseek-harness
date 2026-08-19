/** Verifier request and result vocabulary. @module @deepseek-ai/dsh-verifier/types */

/** One named evaluation criterion shown to the verifier. */
export interface VerifierCriterion {
  /** Short criterion label. */
  readonly name: string
  /** Concrete scoring guidance. */
  readonly description: string
}

/** Explicit best-of-N selection request. */
export interface VerifierSelectRequest {
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

/** Verifier-reported token accounting for one selection. */
export interface VerifierUsage {
  readonly calls: number
  readonly inputTokens: number
  readonly cachedInputTokens: number
  readonly uncachedInputTokens: number
  readonly outputTokens: number
  readonly reasoningTokens: number
}

/** Validated selection result in input-candidate coordinates. */
export interface VerifierSelection {
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
