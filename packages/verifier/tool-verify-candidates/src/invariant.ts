/** Package-owned invariant companion for verify_candidates. @module @deepseek-ai/dsh-tool-verify-candidates/invariant */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
const PACKAGE_NAME = '@deepseek-ai/dsh-tool-verify-candidates'
export const name = 'tool-verify-candidates-invariant'
export const inject = ['invariants']
/** No runtime invariant: the tool delegates Session validation and selection validation to their owning services. */
const install: InvariantInstaller = () => {}
/** Register this package's invariant ownership. */
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
