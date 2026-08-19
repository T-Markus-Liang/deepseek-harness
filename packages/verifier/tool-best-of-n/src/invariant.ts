/** Package-owned invariant companion for best_of_n. @module @deepseek-ai/dsh-tool-best-of-n/invariant */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
const PACKAGE_NAME = '@deepseek-ai/dsh-tool-best-of-n'
export const name = 'tool-best-of-n-invariant'
export const inject = ['invariants']
/** No runtime invariant: subagent, verifier, and Git operation owners validate their own lifecycle relationships. */
const install: InvariantInstaller = () => {}
/** Register this package's invariant ownership. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
