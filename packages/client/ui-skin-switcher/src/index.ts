/**
 * Theme skin switcher, host half: discovers installed skin packages (any
 * profile dependency carrying a `skin.json` manifest) and persists the
 * active-skin choice so the browser half can restore it after reloads.
 *
 * The browser half owns body-attribute activation; this half only answers
 * read/list and write/activate requests against the profile directory.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
// Pulls the `webServer` service onto Context (host/webserver module augmentation).
import type {} from '@deepseek-ai/dsh-host-webserver'

/** Persistent active-skin choice, written next to the profile's package.json. */
const STATE_FILE = 'dsh-skins.json'

export interface SkinInfo {
  /** Skin identity, from `skin.json` `id`. */
  id: string
  /** Display name (Chinese product copy preferred by skins). */
  name: string
  /** English display name when the skin provides one. */
  nameEn?: string
  /** Author name when the skin provides one. */
  author?: string
  /** Body attribute whose presence activates the skin (e.g. `data-dsh-maid-atelier`). */
  bodyAttr: string
  /** Installed package name (the `node_modules` directory name). */
  package: string
}

export interface SkinState {
  /** `id` of the active skin, or null when the built-in theme is active. */
  active: string | null
}

/** The profile this host process booted (`--profile <name>` on the CLI). */
function argvProfile(): string | undefined {
  const argv = process.argv
  const flag = argv.indexOf('--profile')
  const value = flag !== -1 ? argv[flag + 1] : undefined
  if (value !== undefined && !value.startsWith('-'))
    return value
  return undefined
}

/** Resolve a profile name to its directory under DSH_HOME (default ~/.dsh). */
function profileDir(profile: string): string {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'profiles', profile)
}

/** Read a directory defensively: a missing/unreadable entry yields no items. */
function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

/** Scan profile node_modules for packages carrying a `skin.json` manifest. */
export function scanSkins(profile: string): SkinInfo[] {
  const nodeModules = join(profileDir(profile), 'node_modules')
  const found: SkinInfo[] = []
  const visit = (pkgDir: string): void => {
    const manifest = join(pkgDir, 'skin.json')
    if (!existsSync(manifest)) return
    try {
      const skin = JSON.parse(readFileSync(manifest, 'utf8')) as Record<string, unknown>
      if (typeof skin.id !== 'string' || typeof skin.bodyAttr !== 'string') return
      const pkgName = pkgDir.slice(pkgDir.indexOf('node_modules') + 'node_modules'.length + 1)
      found.push({
        id: skin.id,
        name: typeof skin.name === 'string' ? skin.name : skin.id,
        ...(typeof skin.nameEn === 'string' ? { nameEn: skin.nameEn } : {}),
        ...(typeof skin.author === 'string' ? { author: skin.author } : {}),
        bodyAttr: skin.bodyAttr,
        package: pkgName,
      })
    } catch {
      // Invalid skin.json is not a skin; skip silently.
    }
  }
  const scopes = safeReaddir(nodeModules)
  for (const entry of scopes) {
    if (entry === '.bin' || entry.startsWith('.')) continue
    if (entry.startsWith('@')) {
      for (const scoped of safeReaddir(join(nodeModules, entry)))
        visit(join(nodeModules, entry, scoped))
    } else {
      visit(join(nodeModules, entry))
    }
  }
  return found
}

function readState(profile: string): SkinState {
  try {
    const raw = readFileSync(join(profileDir(profile), STATE_FILE), 'utf8')
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return { active: typeof parsed.active === 'string' ? parsed.active : null }
  } catch {
    return { active: null }
  }
}

function writeState(profile: string, state: SkinState): void {
  writeFileSync(join(profileDir(profile), STATE_FILE), JSON.stringify(state, null, 2))
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

/** True when the request's Origin matches its Host — required on the POST route. */
function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin
  const host = request.headers.host
  if (origin === undefined || host === undefined) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/** Register the skin list + activate routes against the host webserver. */
export function apply(ctx: Context): void {
  ctx.inject(['webServer'], (host) => {
    ctx.effect(() => {
      const profile = argvProfile() ?? 'web'
      const disposers = [
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-skins',
          handler: (request, response) => {
            if (request.method !== 'GET') {
              response.writeHead(405, { allow: 'GET' })
              response.end()
              return
            }
            const skins = scanSkins(profile)
            const state = readState(profile)
            sendJson(response, 200, { skins, active: state.active })
          },
        }),
        host.webServer.register({
          kind: 'exact',
          path: '/dsh-skins/activate',
          handler: async (request, response) => {
            if (request.method !== 'POST') {
              response.writeHead(405, { allow: 'POST' })
              response.end()
              return
            }
            if (!sameOrigin(request)) {
              sendJson(response, 403, { error: 'cross-origin request rejected' })
              return
            }
            try {
              const chunks: Buffer[] = []
              for await (const chunk of request) {
                const buffer: Buffer = Buffer.from(chunk)
                if (buffer.length > 4096) {
                  sendJson(response, 413, { error: 'request body too large' })
                  return
                }
                chunks.push(buffer)
              }
              const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as { id?: unknown }
              const id = typeof body.id === 'string' ? body.id : null
              const known = scanSkins(profile).map(skin => skin.id)
              if (id !== null && !known.includes(id)) {
                sendJson(response, 400, { error: `unknown skin: ${id}` })
                return
              }
              writeState(profile, { active: id })
              sendJson(response, 200, { ok: true, active: id })
            } catch (error) {
              sendJson(response, 400, {
                error: error instanceof Error ? error.message : String(error),
              })
            }
          },
        }),
      ]
      return () => {
        for (const dispose of disposers) dispose()
      }
    }, 'dsh-skin-switcher: http routes')
  })
}
