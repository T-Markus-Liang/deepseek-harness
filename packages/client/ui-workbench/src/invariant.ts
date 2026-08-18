import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-workbench'
export const name = 'client-ui-workbench-invariant'
export const inject = ['invariants']

/**
 * No runtime invariant: slot registrations are effects owned and observed by
 * the slot registry, and the inspection reads derive directly from the Host
 * workspace inspector through the wire protocol.
 */
const install: InvariantInstaller = () => {}

export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
