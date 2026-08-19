/** Package-owned invariant companion for the Python verifier provider. @module @deepseek-ai/dsh-verifier-python/invariant */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
const PACKAGE_NAME = '@deepseek-ai/dsh-verifier-python'
export const name = 'verifier-python-invariant'
export const inject = ['invariants']
/** No runtime invariant: the provider owns no durable relationship beyond the awaited subprocess call. */
const install: InvariantInstaller = () => {}
/** Register this package's invariant ownership. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
