/** Package-owned invariant companion for the verifier seam. @module @deepseek-ai/dsh-verifier/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-verifier'
export const name = 'verifier-invariant'
export const inject = ['invariants']

/** Selection results cross the provider call directly and retain no event lifecycle to inspect. */
const install: InvariantInstaller = () => {}

/** Register this package's invariant ownership. */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
