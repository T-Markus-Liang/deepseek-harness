import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../index.js'

function mockContext() {
  const registrations = []
  const tools = { register: tool => { registrations.push(tool); return () => {} } }
  const agent = { ctx: { tools } }
  return {
    registrations,
    agents: { list: () => [agent] },
    inject: () => {},
    provide: () => {},
    effect: () => {},
    on: () => () => {},
  }
}

function parentWithStart(start) {
  return {
    ctx: {
      get: key => key === 'subagents' ? { start } : undefined,
    },
  }
}

test('registers four deterministic routing tools', () => {
  const ctx = mockContext()
  apply(ctx, {})
  assert.deepEqual(ctx.registrations.map(tool => tool.name), ['orchestrate_subagent', 'orchestrate_fork', 'orchestrate_reviewer', 'orchestrate_visual'])
})

test('normal child route overrides the parent model', async () => {
  const ctx = mockContext()
  apply(ctx, {})
  const tool = ctx.registrations.find(entry => entry.name === 'orchestrate_subagent')
  let request
  const parent = parentWithStart(async (_provider, value) => {
    request = value
    return { result: Promise.resolve({ stopReason: 'completed', output: [] }), dispose: async () => {} }
  })
  await tool.execute({ description: 'test', prompt: 'route test' }, { agent: parent, signal: new AbortController().signal })
  assert.deepEqual(request.agentOptions, { provider: 'sensenova', model: 'deepseek-v4-flash', maxTokens: 8192 })
})

test('fork child route also overrides the parent model', async () => {
  const ctx = mockContext()
  apply(ctx, {})
  const tool = ctx.registrations.find(entry => entry.name === 'orchestrate_fork')
  let provider
  let request
  const parent = parentWithStart(async (name, value) => {
    provider = name
    request = value
    return { result: Promise.resolve({ stopReason: 'completed', output: [] }), dispose: async () => {} }
  })
  await tool.execute({ description: 'test', prompt: 'route test' }, { agent: parent, signal: new AbortController().signal })
  assert.equal(provider, 'fork')
  assert.deepEqual(request.agentOptions, { provider: 'sensenova', model: 'deepseek-v4-flash', maxTokens: 8192 })
})

test('review and visual routes use deliberate exceptions', async () => {
  const ctx = mockContext()
  apply(ctx, {})
  const seen = []
  const parent = parentWithStart(async (_name, request) => {
    seen.push(request.agentOptions)
    return { result: Promise.resolve({ stopReason: 'completed', output: [] }), dispose: async () => {} }
  })
  const exec = { agent: parent, signal: new AbortController().signal }
  await ctx.registrations.find(tool => tool.name === 'orchestrate_reviewer').execute({ description: 'review', prompt: 'review' }, exec)
  await ctx.registrations.find(tool => tool.name === 'orchestrate_visual').execute({ description: 'visual', prompt: 'visual' }, exec)
  assert.deepEqual(seen, [
    { provider: 'qilin-review', model: 'gpt-5.6-terra', maxTokens: 16384 },
    { provider: 'coding-plan', model: 'deepseek-v4-visual-flash-exp', maxTokens: 8192 },
  ])
})
