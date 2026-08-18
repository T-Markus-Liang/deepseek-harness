/** Invariant companion for the workspace inspector. */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
const PACKAGE_NAME = '@deepseek-ai/dsh-workspace-inspector'
export const name = 'workspace-inspector-invariant'
export const inject = ['invariants']
/** No runtime invariant: results derive directly from filesystem and Git state. */
const install: InvariantInstaller = () => {}
export const apply = (ctx: Context): Promise<() => void> => Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
