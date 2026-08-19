/**
 * Theme skin switcher, browser half: registers a Settings section that lists
 * installed skins and toggles the active one via body-attribute activation.
 * The host half (`./index.ts`) serves the skin list and persists the choice.
 */
import { createElement } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { SkinSection } from './SkinSection.tsx'
import { en, zh, type SkinSwitcherKey } from './locales.ts'

/** Locale namespace for this plugin's Settings copy. */
const NS = 'skin-switcher'

export type { SkinSectionProps } from './SkinSection.tsx'
export type { SkinSwitcherKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'skin-switcher': SkinSwitcherKey
  }
}

/** Services this client entry reads. */
export const inject = ['slots', 'locale']

/**
 * Global rule hiding inactive skins' decorative nodes. Skin decorations are
 * gated by the skin's own `bodyAttr` selector for styling, but the nodes
 * themselves stay mounted; without this they can leak layout/UI (e.g. a
 * floating shortcut button). `data-skin-switcher-off` is applied by
 * `applySkin` to every `[data-skin-chrome]` node when no skin is active.
 */
const DECOR_OFF_CSS = '[data-skin-chrome][data-skin-switcher-off]{display:none!important}'

/**
 * Register the skin-switcher Settings section. The section is a list-slot
 * contribution to the Settings shell; activation state comes from the host
 * route, so no store or service edge is needed here.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'skin-switcher: dictionaries')
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = '@deepseek-ai/dsh-client-ui-skin-switcher'
    style.textContent = DECOR_OFF_CSS
    document.head.appendChild(style)
    return () => { style.remove() }
  }, 'skin-switcher: decoration-off css')
  const t = ctx.locale.bind(NS)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'skins',
    order: 42,
    label: () => t('nav'),
    locale: NS,
    inject: () => ({ t }),
  }, () => createElement(SkinSection, { t })))
}
