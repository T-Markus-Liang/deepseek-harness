const SETTINGS_NAMESPACE = 'dsh-subagent-orchestrator'
const APPLIED = new WeakSet()
const DEFAULT_RETENTION_DAYS = 14
const DEFAULT_RETENTION_COUNT = 100

const ECONOMY = Object.freeze({
  normal: Object.freeze({ provider: 'sensenova', model: 'deepseek-v4-flash', maxTokens: 8192 }),
  reviewer: Object.freeze({ provider: 'qilin-review', model: 'gpt-5.6-terra', maxTokens: 16384 }),
  visual: Object.freeze({ provider: 'coding-plan', model: 'deepseek-v4-visual-flash-exp', maxTokens: 8192 }),
})

export const name = 'dsh-subagent-orchestrator'
export const inject = ['agents']

export function apply(ctx, config = {}) {
  if (APPLIED.has(ctx)) throw new Error(`${name}: plugin is already applied to this host context`)
  if (typeof ctx.inject !== 'function') throw new Error(`${name}: DSH host lacks ctx.inject`)
  APPLIED.add(ctx)
  const base = resolveConfig(config)
  let options = base
  const state = { settingsActive: false, settingsError: '', records: [] }

  ctx.inject(['settings'], async settingsCtx => {
    const { default: z } = await import('@deepseek-ai/schemastery')
    const schema = z.object({
      mode: z.union(['economy', 'balanced', 'quality']).default('economy'),
      normalProvider: z.string().default(ECONOMY.normal.provider),
      normalModel: z.string().default(ECONOMY.normal.model),
      normalMaxTokens: z.number().step(1).min(1).default(ECONOMY.normal.maxTokens),
      reviewerProvider: z.string().default(ECONOMY.reviewer.provider),
      reviewerModel: z.string().default(ECONOMY.reviewer.model),
      reviewerMaxTokens: z.number().step(1).min(1).default(ECONOMY.reviewer.maxTokens),
      visualProvider: z.string().default(ECONOMY.visual.provider),
      visualModel: z.string().default(ECONOMY.visual.model),
      visualMaxTokens: z.number().step(1).min(1).default(ECONOMY.visual.maxTokens),
      retentionDays: z.number().step(1).min(1).default(DEFAULT_RETENTION_DAYS),
      retentionCount: z.number().step(1).min(1).default(DEFAULT_RETENTION_COUNT),
      migrationAccepted: z.boolean().default(false),
    })
    const scope = settingsCtx.settings.register(SETTINGS_NAMESPACE, schema, {
      base: config,
      validate: value => { resolveConfig(value) },
    })
    const update = () => {
      state.settingsActive = true
      try {
        options = resolveConfig(scope.get())
        state.options = options
        state.settingsError = ''
        pruneRecords(state, options)
      } catch (error) {
        state.settingsError = error instanceof Error ? error.message : String(error)
      }
    }
    update()
    settingsCtx.effect(() => scope.watch(update), `${name}: settings watcher`)
    settingsCtx.effect(() => () => { state.settingsActive = false; options = base }, `${name}: settings fallback`)
  })

  ctx.provide?.('subagentOrchestrator', {
    status: () => Object.freeze({ configured: true, settingsActive: state.settingsActive, settingsError: state.settingsError, options, records: [...state.records], migration: migrationPreview(ctx) }),
    migrationPreview: () => migrationPreview(ctx),
    acceptMigration: () => ({ accepted: true, note: 'Persist migrationAccepted in the Web settings card. Remove fallbacks.roles only after a human confirms the preview.' }),
    resolveAgentOptions: (role) => {
      const known = { normal: options.normal, reviewer: options.reviewer, visual: options.visual }
      const route = known[role] || options.normal
      return { provider: route.provider, model: route.model, maxTokens: route.maxTokens }
    },
  })

  // Tool discovery is Agent-scoped in DSH. Host-scoped registration makes a
  // settings card load but leaves the tools absent from every model catalog.
  const installed = new Map()
  const install = agent => {
    if (installed.has(agent) || !agent?.ctx?.tools) return
    const disposers = [
      agent.ctx.tools.register(delegationTool('orchestrate_subagent', 'Dispatch a low-cost fresh subagent on DeepSeek V4 Flash.', () => options.normal, state)),
      agent.ctx.tools.register(delegationTool('orchestrate_fork', 'Dispatch a low-cost subagent with inherited conversation context on DeepSeek V4 Flash.', () => options.normal, state, true)),
      agent.ctx.tools.register(delegationTool('orchestrate_reviewer', 'Dispatch a high-quality read-only code or security reviewer.', () => options.reviewer, state)),
      agent.ctx.tools.register(delegationTool('orchestrate_visual', 'Dispatch a visual subagent on Command Code DeepSeek V4 Visual Flash Exp. Use for image understanding.', () => options.visual, state)),
    ]
    installed.set(agent, () => { for (const dispose of disposers.reverse()) dispose?.() })
  }
  for (const agent of ctx.agents?.list?.() ?? []) install(agent)
  const stopCreated = ctx.on?.('agent/created', ({ agent }) => { install(agent) })
  const stopDisposed = ctx.on?.('agent/disposed', ({ agent }) => {
    installed.get(agent)?.()
    installed.delete(agent)
  })
  ctx.effect(() => () => {
    stopCreated?.()
    stopDisposed?.()
    for (const dispose of installed.values()) dispose()
    installed.clear()
    APPLIED.delete(ctx)
  })
}

function delegationTool(toolName, description, route, state, fork = false) {
  return {
    name: toolName,
    description,
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'Short task label.' },
        prompt: { type: 'string', description: 'Complete standalone task prompt.' },
      },
      required: ['description', 'prompt'],
    },
    output: { schema: { type: 'object' }, render: (_args, value) => [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] },
    execute: async ({ description: label, prompt }, exec) => {
      const parent = exec?.agent
      if (!parent) throw new Error(`${name}: ${toolName} requires a calling agent`)
      const selected = route()
      const startedAt = Date.now()
      const run = await parent.ctx.get('subagents').start(fork ? 'fork' : 'spawn', {
        label,
        prompt: [{ type: 'text', text: prompt }],
        parent,
        signal: exec.signal,
        agentOptions: { provider: selected.provider, model: selected.model, maxTokens: selected.maxTokens },
      })
      try {
        const result = await run.result
        record(state, { at: new Date().toISOString(), tool: toolName, label, provider: selected.provider, model: selected.model, maxTokens: selected.maxTokens, fork, stopReason: result.stopReason, durationMs: Date.now() - startedAt })
        return { ok: result.stopReason === 'completed', provider: selected.provider, model: selected.model, stopReason: result.stopReason, output: result.output, diagnostic: result.diagnostic }
      } finally {
        await run.dispose()
      }
    },
  }
}

function resolveConfig(config) {
  const mode = string(config, 'mode', 'economy')
  if (!['economy', 'balanced', 'quality'].includes(mode)) throw new Error(`${name}: mode must be economy, balanced, or quality`)
  const normal = route(config, 'normal', ECONOMY.normal)
  const reviewer = route(config, 'reviewer', ECONOMY.reviewer)
  const visual = route(config, 'visual', ECONOMY.visual)
  return Object.freeze({ mode, normal, reviewer, visual, retentionDays: number(config, 'retentionDays', DEFAULT_RETENTION_DAYS), retentionCount: number(config, 'retentionCount', DEFAULT_RETENTION_COUNT), migrationAccepted: config.migrationAccepted === true })
}

function route(config, key, fallback) {
  const cap = key[0].toUpperCase() + key.slice(1)
  const provider = string(config, `${key}Provider`, fallback.provider)
  const model = string(config, `${key}Model`, fallback.model)
  const maxTokens = number(config, `${key}MaxTokens`, fallback.maxTokens)
  if (!provider || !model || maxTokens < 1) throw new Error(`${name}: ${key} route is invalid`)
  return Object.freeze({ provider, model, maxTokens })
}

function string(config, key, fallback) { const value = config[key]; return typeof value === 'string' && value.trim() ? value.trim() : fallback }
function number(config, key, fallback) { const value = config[key]; return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : fallback }
function record(state, value) { state.records.unshift(Object.freeze(value)); pruneRecords(state, state.options ?? { retentionDays: DEFAULT_RETENTION_DAYS, retentionCount: DEFAULT_RETENTION_COUNT }) }
function pruneRecords(state, options) { const cutoff = Date.now() - options.retentionDays * 86_400_000; state.records = state.records.filter((item, index) => index < options.retentionCount && Date.parse(item.at) >= cutoff) }
function migrationPreview(ctx) {
  const fallback = ctx.get?.('llmFallbacks')
  const configured = fallback?.status?.() ?? null
  return Object.freeze({ required: configured !== null, source: 'fallbacks.roles', action: 'Human confirmation required before removing legacy subagent role chains.', detected: configured })
}
