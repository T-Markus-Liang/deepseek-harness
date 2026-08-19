import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import type { SubagentProvider } from '@deepseek-ai/dsh-subagent'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { Verifier } from '@deepseek-ai/dsh-verifier'
import type { VerifierSelectRequest, VerifierSelection } from '@deepseek-ai/dsh-verifier'
import * as ToolBestOfN from '../src/index.ts'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

class UnreachableVerifier extends Verifier {
  override select(_request: VerifierSelectRequest): Promise<VerifierSelection> {
    return Promise.reject(new Error('Loader composition does not execute the verifier'))
  }
}

function verifierPlugin(ctx: Context): void {
  new UnreachableVerifier(ctx)
}

const subagentProviderPlugin = Object.assign((ctx: Context): void => {
  const provider: SubagentProvider = {
    name: 'isolated',
    capabilities: {
      outputSchema: false,
      depthLimit: false,
      toolFilter: false,
      persona: false,
      workspaceCwd: true,
    },
    inheritsParentContext: false,
    start: () => Promise.reject(new Error('Loader composition does not start candidates')),
  }
  ctx.subagents.registerProvider(provider)
}, { inject: ['subagents'] })

async function boot(): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-best-of-n-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-subprocess-local'",
    "- name: '@deepseek-ai/dsh-subagent'",
    "- name: 'test-isolated-subagent-provider'",
    "- name: 'test-verifier'",
    "- name: '@deepseek-ai/dsh-tool-best-of-n'",
    '  config:',
    '    toolName: choose_best_patch',
    '    subagentProvider: isolated',
    '    verifierModel: loader-verifier',
    '    maxCandidates: 3',
    '',
  ].join('\n'))

  const ctx = new Context()
  context = ctx
  ctx.baseUrl = pathToFileURL(root).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['@deepseek-ai/dsh-subprocess-local', LocalSubprocessRuntime],
    ['@deepseek-ai/dsh-subagent', SubagentRuntime],
    ['test-isolated-subagent-provider', subagentProviderPlugin],
    ['test-verifier', verifierPlugin],
    ['@deepseek-ai/dsh-tool-best-of-n', ToolBestOfN],
  ])
  ctx.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof ctx.loader.internal>
  await ctx.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await ctx.loader.await()
  return ctx
}

describe('best_of_n real Loader composition', () => {
  it('loads the verifier, workspace-aware subagent provider, and renamed tool from cordis.yml', async () => {
    const ctx = await boot()
    const schema = ctx.tools.schemas().find(item => item.name === 'choose_best_patch')

    expect(schema?.parameters).toMatchObject({
      type: 'object',
      properties: {
        objective: { type: 'string' },
        candidates: { type: 'integer' },
      },
    })
    expect(ctx.subagents.getProvider('isolated')?.capabilities.workspaceCwd).toBe(true)
    expect([...ctx.loader.entries()].filter(entry => entry.fiber === undefined && !entry.disabled)).toEqual([])
  }, 30_000)
})
