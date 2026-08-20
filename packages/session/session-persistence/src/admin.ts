/**
 * Optional management operations for session persistence. Backends that support
 * physical destroy and relocate register this service alongside the core
 * {@link SessionPersistence} service. Consumers that need these operations
 * use `ctx.get('sessionPersistenceAdmin')` so the dependency is optional.
 * @module @deepseek-ai/dsh-session-persistence/admin
 */

import { Context, Service } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'

declare module '@deepseek-ai/cordis' {
  interface Context {
    sessionPersistenceAdmin: SessionPersistenceAdmin
  }
}

/**
 * Administrative durable storage operations. A backend that supports these
 * registers this service by extending this class; a consumer uses
 * `ctx.get('sessionPersistenceAdmin')` to obtain it when available.
 *
 * The caller MUST ensure the session is not live (has no loaded agent) before
 * calling destroy or relocate — backends provide no live-session guard.
 */
export abstract class SessionPersistenceAdmin extends Service {
  constructor(ctx: Context) {
    super(ctx, 'sessionPersistenceAdmin')
  }

  /**
   * Physically delete every durable artifact of one stored session. Idempotent:
   * destroying an id with no stored artifact resolves without error.
   * @param id - persisted session id to destroy.
   */
  abstract destroy(id: SessionId): Promise<void>

  /**
   * Relocate a stored session to a new project directory by rewriting its
   * header `cwd` and moving the durable artifact to the path derived from
   * `newCwd`. Idempotent: an id with no stored artifact resolves silently.
   * @param id - persisted session id to relocate.
   * @param newCwd - absolute path of the new project directory.
   */
  abstract relocate(id: SessionId, newCwd: string): Promise<void>
}
