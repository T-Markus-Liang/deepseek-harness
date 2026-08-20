/** Detached session lifecycle operations kept outside the rc.8 persistence read/write seam. */
import type { SessionId } from '@deepseek-ai/dsh-session'

/** Durable operations on a session that is no longer live. */
export interface SessionLifecycle {
  /** Remove every durable artifact for one detached session. */
  remove(id: SessionId): Promise<void>
  /** Move one detached session and rewrite its persisted working directory. */
  move(id: SessionId, newCwd: string): Promise<void>
}
