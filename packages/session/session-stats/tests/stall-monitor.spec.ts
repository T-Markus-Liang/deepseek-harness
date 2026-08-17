/**
 * Stall monitor behavior: the `stallThresholdMs` config arms a per-session
 * timer on `step/start` that warns through the logger when the step stays open
 * past the threshold, and is cancelled by `step/end` and `turn/end`. Without
 * the config the plugin registers only the projection fold and arms nothing.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import * as SessionStatsPlugin from '@deepseek-ai/dsh-session-stats'

async function mount(thresholdMs?: number): Promise<{ ctx: Context; fiber: { dispose(): Promise<void> } }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  const fiber = thresholdMs === undefined
    ? await ctx.plugin(SessionStatsPlugin)
    : await ctx.plugin(SessionStatsPlugin, { stallThresholdMs: thresholdMs })
  return { ctx, fiber }
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('sessionStats stall monitor', () => {
  it('arms no timer when the threshold is omitted', async () => {
    vi.useFakeTimers()
    const { ctx } = await mount()
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => undefined)
    const session = ctx.sessions.create(SessionId('no-threshold'))
    session.append('step/start', { turn: 1, step: 1 })
    await vi.advanceTimersByTimeAsync(60_000)
    session.append('step/end', { turn: 1, step: 1 })
    expect(warn).not.toHaveBeenCalled()
  })

  it('treats a zero threshold as disabled', async () => {
    vi.useFakeTimers()
    const { ctx } = await mount(0)
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => undefined)
    const session = ctx.sessions.create(SessionId('zero-threshold'))
    session.append('step/start', { turn: 1, step: 1 })
    await vi.advanceTimersByTimeAsync(60_000)
    session.append('step/end', { turn: 1, step: 1 })
    expect(warn).not.toHaveBeenCalled()
  })

  it('warns when an open step exceeds the threshold and names the boundary', async () => {
    vi.useFakeTimers()
    const { ctx } = await mount(50)
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => undefined)
    const session = ctx.sessions.create(SessionId('stalled'))
    session.append('turn/start', { turn: 1 })
    session.append('step/start', { turn: 1, step: 3 })
    await vi.advanceTimersByTimeAsync(60)
    expect(warn).toHaveBeenCalledTimes(1)
    const args = warn.mock.calls[0] ?? []
    expect(String(args[0])).toContain('step stall')
    expect(args[1]).toBe(1)
    expect(args[2]).toBe(3)
    session.append('step/end', { turn: 1, step: 3 })
  })

  it('cancels the timer when the step closes before the threshold', async () => {
    vi.useFakeTimers()
    const { ctx } = await mount(50)
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => undefined)
    const session = ctx.sessions.create(SessionId('quick'))
    session.append('step/start', { turn: 1, step: 1 })
    session.append('step/end', { turn: 1, step: 1 })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(warn).not.toHaveBeenCalled()
  })

  it('cancels the timer when the turn ends before the threshold', async () => {
    vi.useFakeTimers()
    const { ctx } = await mount(50)
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => undefined)
    const session = ctx.sessions.create(SessionId('turn-ended'))
    session.append('step/start', { turn: 1, step: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(warn).not.toHaveBeenCalled()
  })

  it('ignores a step/end that does not match the armed boundary', async () => {
    vi.useFakeTimers()
    const { ctx } = await mount(50)
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => undefined)
    const session = ctx.sessions.create(SessionId('mismatched'))
    session.append('step/start', { turn: 1, step: 1 })
    session.append('step/end', { turn: 1, step: 2 })
    await vi.advanceTimersByTimeAsync(60)
    // The unmatched step/end leaves step 1's timer armed, so it still warns.
    expect(warn).toHaveBeenCalledTimes(1)
    session.append('step/end', { turn: 1, step: 1 })
  })

  it('replaces the stale timer when a new step starts on the same session', async () => {
    vi.useFakeTimers()
    const { ctx } = await mount(50)
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => undefined)
    const session = ctx.sessions.create(SessionId('rearm'))
    session.append('step/start', { turn: 1, step: 1 })
    session.append('step/end', { turn: 1, step: 1 })
    session.append('step/start', { turn: 1, step: 2 })
    await vi.advanceTimersByTimeAsync(60)
    expect(warn).toHaveBeenCalledTimes(1)
    session.append('step/end', { turn: 1, step: 2 })
  })

  it('clears an armed timer when a step starts before the previous one closed', async () => {
    vi.useFakeTimers()
    const { ctx } = await mount(50)
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => undefined)
    const session = ctx.sessions.create(SessionId('early-rearm'))
    session.append('step/start', { turn: 1, step: 1 })
    session.append('step/start', { turn: 1, step: 2 })
    await vi.advanceTimersByTimeAsync(60)
    // Only the latest boundary's timer is armed, so exactly one warning fires.
    expect(warn).toHaveBeenCalledTimes(1)
    session.append('step/end', { turn: 1, step: 2 })
  })

  it('ignores a turn/end that arrives with no armed step timer', async () => {
    vi.useFakeTimers()
    const { ctx } = await mount(50)
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => undefined)
    const session = ctx.sessions.create(SessionId('empty-turn-end'))
    session.append('turn/start', { turn: 1 })
    session.append('turn/end', { turn: 1, reason: { kind: 'completed' } })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(warn).not.toHaveBeenCalled()
  })

  it('stays quiet for events that are not step boundaries', async () => {
    vi.useFakeTimers()
    const { ctx } = await mount(50)
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => undefined)
    const session = ctx.sessions.create(SessionId('quiet'))
    session.append('turn/start', { turn: 1 })
    session.append('turn/start', { turn: 2 })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(warn).not.toHaveBeenCalled()
  })

  it('clears the armed timer when the plugin fiber is disposed', async () => {
    vi.useFakeTimers()
    const { ctx, fiber } = await mount(50)
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => undefined)
    const session = ctx.sessions.create(SessionId('disposed'))
    session.append('step/start', { turn: 1, step: 1 })
    await fiber.dispose()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(warn).not.toHaveBeenCalled()
  })
})
