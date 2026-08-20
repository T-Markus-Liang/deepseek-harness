/**
 * sessions.stop: the hard agent teardown behind workspace migration. The proxy
 * retains the AgentHandle from every create/resume it issued, and stop calls
 * that exact handle's dispose — the only teardown capability the registry
 * exposes. These benches cover the dispose path, the ownership fence, and the
 * two refusals (not attached, live-but-unowned).
 */

import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SessionStore from '@deepseek-ai/dsh-session'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent, CreateAgentOptions, AgentHandle } from '@deepseek-ai/dsh-agent'
import UserQuestionService from '@deepseek-ai/dsh-user-questions'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { RpcRequest } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api/rpc'
import { createApiProxy } from '@deepseek-ai/dsh-host-apiproxy'

const sid = (id: string): SessionId => id as SessionId

let nextRpc = 1
function request<P>(payload: P): RpcRequest<P> {
  return { rpcId: RpcId(`stop-${String(nextRpc++)}`), payload }
}

/**
 * Build a Context whose factory records the dispose closures it hands out, so
 * a bench can assert exactly which handle was torn down.
 */
async function composed(): Promise<{
  ctx: Context
  api: ReturnType<typeof createApiProxy>
  disposed: ReturnType<typeof vi.fn<() => Promise<void>>>
}> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(UserQuestionService)
  const disposed = vi.fn(() => Promise.resolve())
  ctx.agents.setFactory({
    createAgent: (ownerCtx: Context, options: CreateAgentOptions): Promise<AgentHandle> => {
      const session = ctx.sessions.create(options.sessionId, {
        ...options.meta === undefined ? {} : { meta: options.meta },
      })
      const agent = { id: session.id, session, status: 'idle', ctx: ownerCtx } as Agent
      ctx.agents.register(agent)
      return Promise.resolve({ agent, dispose: disposed })
    },
    resume: () => Promise.reject(new Error('resume must not run: every source here is created fresh')),
  })
  return {
    ctx,
    api: createApiProxy(ctx, { defaultModelSelection: () => ({ provider: 'p', model: 'm' }), cwd: '/tmp' }),
    disposed,
  }
}

describe('sessions.stop', () => {
  it('disposes the handle the proxy retained for a session it created', async () => {
    const { ctx, api, disposed } = await composed()
    const created = await api.sessions.create(request({ sessionId: sid('session-stop-1'), cwd: '/tmp' }))
    expect(created.result.ok).toBe(true)
    expect(ctx.agents.get(sid('session-stop-1'))).toBeDefined()

    const stopped = await api.sessions.stop(request({ sessionId: sid('session-stop-1') }))
    expect(stopped.result.ok).toBe(true)
    if (stopped.result.ok) expect(stopped.result.value).toEqual({ stopped: true })
    expect(disposed).toHaveBeenCalledOnce()
  })

  it('retains ownership when disposal fails so stop can be retried', async () => {
    const { api, disposed } = await composed()
    disposed.mockRejectedValueOnce(new Error('busy teardown'))
    await api.sessions.create(request({ sessionId: sid('session-stop-retry'), cwd: '/tmp' }))

    const failed = await api.sessions.stop(request({ sessionId: sid('session-stop-retry') }))
    expect(failed.result.ok).toBe(false)
    if (!failed.result.ok) expect(failed.result.error.message).toContain('busy teardown')

    const retried = await api.sessions.stop(request({ sessionId: sid('session-stop-retry') }))
    expect(retried.result.ok).toBe(true)
    expect(disposed).toHaveBeenCalledTimes(2)
  })

  it('rejects a session with no live agent', async () => {
    const { api } = await composed()
    const stopped = await api.sessions.stop(request({ sessionId: sid('session-stop-absent') }))
    expect(stopped.result.ok).toBe(false)
    if (!stopped.result.ok) expect(stopped.result.error.code).toBe('session-not-found')
  })

  it('rejects a live agent this proxy did not create (no retained handle)', async () => {
    const { ctx, api } = await composed()
    const session = ctx.sessions.create(sid('session-stop-unowned'), { meta: { cwd: '/proj' } })
    ctx.agents.register({ id: session.id, session, status: 'idle', ctx } as Agent)
    const stopped = await api.sessions.stop(request({ sessionId: session.id }))
    expect(stopped.result.ok).toBe(false)
    if (!stopped.result.ok) expect(stopped.result.error.code).toBe('internal')
  })

  it('rejects an origin-marked subagent without touching its handle', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(AgentRegistry)
    await ctx.plugin(UserQuestionService)
    const parentSession = ctx.sessions.create(sid('session-parent'), { meta: { cwd: '/proj' } })
    const parent = { id: parentSession.id, session: parentSession, status: 'idle', ctx } as Agent
    ctx.agents.register(parent)
    const childSession = ctx.sessions.create(sid('session-subagent-child'), {
      meta: { cwd: '/proj', parentSession: parent.id, origin: 'subagent' },
    })
    const child = { id: childSession.id, session: childSession, status: 'idle', ctx } as Agent
    ctx.agents.register(child)
    const api = createApiProxy(ctx, { defaultModelSelection: () => ({ provider: 'p', model: 'm' }), cwd: '/tmp' })

    const stopped = await api.sessions.stop(request({ sessionId: child.id }))
    expect(stopped.result.ok).toBe(false)
    if (!stopped.result.ok) expect(stopped.result.error.code).toBe('session-subagent')
  })
})
