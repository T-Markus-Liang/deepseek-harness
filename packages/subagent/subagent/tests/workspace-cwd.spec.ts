import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { SESSION_FORMAT_VERSION, Session, SessionId } from '@deepseek-ai/dsh-session'
import SubagentRuntime from '../src/index.ts'
import type { ResolvedSubagentStartRequest, SubagentProvider, SubagentRun } from '../src/index.ts'

function parent(ctx: Context): Agent {
  const id = SessionId('parent')
  const session = Session.create(id, undefined, {
    version: SESSION_FORMAT_VERSION, id, createdAt: 1, cwd: '/parent',
  })
  return { id, session, ctx } as unknown as Agent
}

function provider(workspaceCwd: boolean) {
  const start = vi.fn<(request: ResolvedSubagentStartRequest) => Promise<SubagentRun>>(_request => Promise.resolve({
    id: SessionId('child'),
    localAgent: undefined,
    result: Promise.resolve({ output: [], stopReason: 'completed' }),
    dispose: () => Promise.resolve(),
  }))
  const value: SubagentProvider = {
    name: 'test',
    capabilities: { outputSchema: false, depthLimit: false, toolFilter: false, persona: false, workspaceCwd },
    inheritsParentContext: false,
    start,
  }
  return { value, start }
}

describe('one-shot subagent workspace cwd', () => {
  it('forwards an absolute override only when the provider advertises support', async () => {
    const ctx = new Context()
    await ctx.plugin(SubagentRuntime)
    const candidate = provider(true)
    ctx.subagents.registerProvider(candidate.value)
    const run = await ctx.subagents.start('test', {
      prompt: [], parent: parent(ctx), signal: new AbortController().signal, workspaceCwd: '/isolated/candidate',
    })
    expect(candidate.start).toHaveBeenCalledWith(expect.objectContaining({ workspaceCwd: '/isolated/candidate' }))
    await run.dispose()
  })

  it('rejects unsupported or relative overrides before provider dispatch', async () => {
    const unsupportedCtx = new Context()
    await unsupportedCtx.plugin(SubagentRuntime)
    const unsupported = provider(false)
    unsupportedCtx.subagents.registerProvider(unsupported.value)
    await expect(unsupportedCtx.subagents.start('test', {
      prompt: [], parent: parent(unsupportedCtx), signal: new AbortController().signal, workspaceCwd: '/isolated/candidate',
    })).rejects.toMatchObject({ code: 'UNSUPPORTED_CAPABILITY' })
    expect(unsupported.start).not.toHaveBeenCalled()

    const relativeCtx = new Context()
    await relativeCtx.plugin(SubagentRuntime)
    const relative = provider(true)
    relativeCtx.subagents.registerProvider(relative.value)
    await expect(relativeCtx.subagents.start('test', {
      prompt: [], parent: parent(relativeCtx), signal: new AbortController().signal, workspaceCwd: 'relative/path',
    })).rejects.toThrow(/must be an absolute path/)
    expect(relative.start).not.toHaveBeenCalled()
  })
})
