/**
 * Skin switcher settings section: lists installed skins from the host API and
 * toggles the active one. Activation is a pure body-attribute swap — each skin
 * gates its whole stylesheet behind its `bodyAttr`, so removing every known
 * skin attribute and setting only the chosen one yields exactly one active
 * skin without touching any bundle wiring.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { SkinInfo } from '../index.ts'
import type { SkinSwitcherKey } from './locales.ts'
import styles from './SkinSection.module.css'

export interface SkinSectionProps {
  /** Bound locale dictionary for the `skin-switcher` namespace. */
  t: (key: SkinSwitcherKey) => string
}

/**
 * Activate one skin (or none): set the chosen skin's body attribute, remove
 * every other known skin's attribute, hide the inactive skins' injected
 * decorative nodes, and restore the default document title when no skin is
 * active. Skins own their stylesheet behind `bodyAttr`, so this attribute
 * swap is the whole activation mechanism; decoration nodes keep their
 * existence so switching back restores them instantly.
 */
const DEFAULT_TITLE = 'DeepSeek Harness'
const SKIN_OFF_ATTR = 'data-skin-switcher-off'

function applySkin(activeId: string | null, skins: SkinInfo[]): void {
  const body = document.body
  const decorations = body.querySelectorAll('[data-skin-chrome]')
  for (const skin of skins) {
    if (skin.id === activeId) {
      body.setAttribute(skin.bodyAttr, '')
    } else {
      body.removeAttribute(skin.bodyAttr)
    }
  }
  for (const node of decorations) {
    if (activeId === null) node.setAttribute(SKIN_OFF_ATTR, '')
    else node.removeAttribute(SKIN_OFF_ATTR)
  }
  if (activeId === null && document.title !== DEFAULT_TITLE)
    document.title = DEFAULT_TITLE
}

/** Fetch the installed skins + persisted active choice from the host. */
async function fetchSkins(): Promise<{ skins: SkinInfo[]; active: string | null }> {
  const response = await fetch('/dsh-skins', { cache: 'no-store' })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()) as { skins: SkinInfo[]; active: string | null }
}

/** Persist the active choice to the host (best-effort, UI already applied it). */
function persistActive(id: string | null): void {
  void fetch('/dsh-skins/activate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  }).catch(() => {
    // Persistence failure does not undo the live switch.
  })
}

export function SkinSection({ t }: SkinSectionProps): ReactElement {
  const [skins, setSkins] = useState<SkinInfo[] | null>(null)
  const [active, setActive] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  // Observer callbacks read the latest choice without re-subscribing on every
  // switch; state stays the single source for rendering.
  const activeRef = useRef<string | null>(null)
  const skinsRef = useRef<SkinInfo[] | null>(null)
  activeRef.current = active
  skinsRef.current = skins

  useEffect(() => {
    let live = true
    fetchSkins()
      .then((body) => {
        if (!live) return
        setSkins(body.skins)
        // First visit with no persisted choice: adopt whichever skin is already
        // activating the page (skins auto-activate on load), so the switch does
        // not silently turn the visible skin off before the user chooses.
        let effective = body.active
        if (effective === null) {
          const activating = body.skins.find(skin =>
            document.body.hasAttribute(skin.bodyAttr))
          effective = activating?.id ?? null
        }
        setActive(effective)
        applySkin(effective, body.skins)
        if (effective !== body.active) persistActive(effective)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [])

  // Skins auto-activate on load at their own pace; re-apply the chosen state
  // whenever any known skin attribute changes so the final state always
  // matches the user's selection.
  useEffect(() => {
    if (skins === null) return
    const filter: string[] = skins.map(skin => skin.bodyAttr)
    const observer = new MutationObserver(() => {
      if (skinsRef.current === null) return
      applySkin(activeRef.current, skinsRef.current)
    })
    observer.observe(document.body, { attributes: true, attributeFilter: filter })
    return () => { observer.disconnect() }
  }, [skins])

  const choose = (id: string | null): void => {
    setActive(id)
    if (skins !== null) applySkin(id, skins)
    persistActive(id)
  }

  return (
    <section className={styles.root}>
      <p className={styles.subtitle}>{t('subtitle')}</p>
      {failed ? (
        <p className={styles.fail}>{t('fail')}</p>
      ) : skins === null ? (
        <p className={styles.loading}>{t('loading')}</p>
      ) : skins.length === 0 ? (
        <p className={styles.empty}>{t('empty')}</p>
      ) : (
        <ul className={styles.list}>
          <li className={styles.row}>
            <button
              type="button"
              className={styles.choice}
              data-active={active === null ? '' : undefined}
              onClick={() => { choose(null) }}
            >
              <span className={styles.name}>{t('none')}</span>
              <span className={styles.hint}>{t('noneHint')}</span>
            </button>
          </li>
          {skins.map(skin => (
            <li key={skin.id} className={styles.row}>
              <button
                type="button"
                className={styles.choice}
                data-active={active === skin.id ? '' : undefined}
                onClick={() => { choose(skin.id) }}
              >
                <span className={styles.name}>
                  {skin.name}
                  {skin.author !== undefined ? (
                    <span className={styles.author}> · {skin.author}</span>
                  ) : null}
                </span>
                <span className={styles.hint}>
                  {active === skin.id ? t('active') : t('activate')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function skinSectionFactory(props: SkinSectionProps): ReactElement {
  return <SkinSection {...props} />
}
