/** Deterministic keyless trajectory verifier for the assembled snapshot. */

import type { Context } from '@deepseek-ai/cordis'
import { Verifier } from '@deepseek-ai/dsh-verifier'
import type { VerifierSelectRequest, VerifierSelection } from '@deepseek-ai/dsh-verifier'

class SnapshotVerifier extends Verifier {
  override select(request: VerifierSelectRequest): Promise<VerifierSelection> {
    if (request.model !== 'snapshot-verifier' || request.candidates.length !== 2) {
      return Promise.reject(new Error('verifier snapshot received unexpected selection config'))
    }
    if (!request.candidates[0]?.includes('candidate A') || !request.candidates[1]?.includes('candidate B')) {
      return Promise.reject(new Error('verifier snapshot received unexpected candidate trajectories'))
    }
    return Promise.resolve({
      index: 1,
      ranking: [1, 0],
      scores: [0.25, 0.75],
      comparisons: 2,
      criteria: ['correctness'],
      usage: {
        calls: 2,
        inputTokens: 12,
        cachedInputTokens: 2,
        uncachedInputTokens: 10,
        outputTokens: 4,
        reasoningTokens: 1,
      },
    })
  }
}

export const name = 'verifier-snapshot-provider'

/** Register the deterministic snapshot verifier. */
export function apply(ctx: Context): void {
  new SnapshotVerifier(ctx)
}
