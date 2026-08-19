/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-skin-switcher`.
 * @module @deepseek-ai/dsh-client-ui-skin-switcher/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-skin-switcher'

/** Cordis companion plugin name. */
export const name = 'client-ui-skin-switcher-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the switcher reads installed skins and persists the
 * active choice through typed HTTP routes, and the browser half toggles body
 * attributes only. There is no cross-plugin Cordis service or event stream to
 * own; route conflicts fail loud in the webserver's duplicate-path check and
 * activation persistence is covered by the host route's own tests.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
