/** Service Definition for selecting the best complete candidate trajectory. @module @deepseek-ai/dsh-verifier */

import { Context, Service } from '@deepseek-ai/cordis'
import type { VerifierSelectRequest, VerifierSelection } from './types.ts'

export type { VerifierCriterion, VerifierSelectRequest, VerifierSelection, VerifierUsage } from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    verifier: Verifier
  }
}

/** Verifier capability implemented by an external scoring backend. */
export abstract class Verifier extends Service {
  constructor(ctx: Context) {
    super(ctx, 'verifier')
  }

  /**
   * Rank complete trajectories for one task.
   * @param request - explicit candidates, criteria, model, tournament settings, and cancellation.
   * @returns the validated best-first selection.
   */
  abstract select(request: VerifierSelectRequest): Promise<VerifierSelection>
}

export default Verifier
