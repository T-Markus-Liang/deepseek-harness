import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scanSkins } from '../src/index.ts'

const originalHome = process.env.DSH_HOME

function withHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'dsh-skins-test-'))
  process.env.DSH_HOME = home
  return home
}

afterEach(() => {
  if (originalHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = originalHome
})

describe('scanSkins', () => {
  it('finds packages carrying a skin.json manifest', () => {
    const home = withHome()
    const nm = join(home, 'profiles', 'web', 'node_modules')
    const top = join(nm, 'dsh-skin-a')
    mkdirSync(top, { recursive: true })
    writeFileSync(join(top, 'skin.json'), JSON.stringify({
      id: 'skin-a',
      name: '皮肤甲',
      bodyAttr: 'data-dsh-skin-a',
    }))
    const scoped = join(nm, '@dsh-external', 'dsh-client-ui-skin-b')
    mkdirSync(scoped, { recursive: true })
    writeFileSync(join(scoped, 'skin.json'), JSON.stringify({
      id: 'skin-b',
      name: 'Skin B',
      nameEn: 'Skin B',
      author: 'Author',
      bodyAttr: 'data-dsh-skin-b',
    }))
    // A package without skin.json must be ignored.
    mkdirSync(join(nm, 'dsh-plain'), { recursive: true })

    const found = scanSkins('web')
    expect(found).toHaveLength(2)
    expect(found).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'skin-a', name: '皮肤甲', bodyAttr: 'data-dsh-skin-a', package: 'dsh-skin-a' }),
      expect.objectContaining({ id: 'skin-b', name: 'Skin B', author: 'Author', package: '@dsh-external/dsh-client-ui-skin-b' }),
    ]))
  })

  it('skips invalid manifests and missing node_modules', () => {
    const home = withHome()
    const nm = join(home, 'profiles', 'web', 'node_modules')
    mkdirSync(join(nm, 'dsh-bad'), { recursive: true })
    writeFileSync(join(nm, 'dsh-bad', 'skin.json'), '{not json')
    mkdirSync(join(nm, 'dsh-no-id'), { recursive: true })
    writeFileSync(join(nm, 'dsh-no-id', 'skin.json'), JSON.stringify({ name: 'no id', bodyAttr: 'x' }))

    expect(scanSkins('web')).toHaveLength(0)
    expect(scanSkins('missing-profile')).toHaveLength(0)
  })
})
