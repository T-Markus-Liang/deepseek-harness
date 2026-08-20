# Agent Note: A Settings theme-skin switcher for the web GUI

Status: implemented

English | [中文](2026-08-19-skin-switcher-settings-section.zh.md)

## Problem

Third-party skin packages (e.g. `dsh-deep-whale#maid-atelier`) activate by setting a body attribute (`bodyAttr`) that gates their whole stylesheet, and they auto-activate unconditionally at load. Installing several skins makes every one activate at once, their CSS conflicts, and the GUI offers no way to choose between them.

## Decision

A new client plugin package `@deepseek-ai/dsh-client-ui-skin-switcher` registers a Settings section that lists every installed skin and keeps exactly one active. The host half scans profile `node_modules` for packages carrying a `skin.json` manifest and serves them through `GET /dsh-skins`, persisting the active choice to `<profile>/dsh-skins.json` via `POST /dsh-skins/activate` (same-origin checked). The browser half toggles body attributes: it removes every known skin's `bodyAttr` and sets only the chosen one, hides inactive skins' injected `[data-skin-chrome]` decoration nodes through a plugin-owned style rule, and restores the default document title when no skin is active.

A first visit with no persisted choice adopts whichever skin is already activating the page, so the switch does not silently turn the visible skin off. A `MutationObserver` on the known skin attributes re-applies the chosen state whenever a skin auto-activates later, defeating the skins' unconditional self-activation.

The switcher is independent of dshmarket's server-side theme machinery, which has no UI and does not classify `file:`-installed skins. Activation is a pure attribute swap; bundle wiring is untouched.

## Alternatives considered

- **Reuse dshmarket's `activateTheme`/`disabledThemes`** — no UI exists, and `file:`-installed skins are not recognized as themes.
- **Unmount inactive skin bundles** — requires loader surgery and risks the skin's own `apply` side effects (title, decorations) leaking; the attribute gate already neutralizes its stylesheet.
- **Persist the choice in localStorage only** — the host route keeps the choice with the profile, shared across browsers and devices.

## Consequences

- Users install multiple skins without CSS conflicts and switch from Settings → 主题皮肤; the default look (the built-in theme) is always one click away.
- Inactive skins' decoration nodes stay mounted but hidden; a future revision could remove them entirely.
- The skin list is generated at Settings mount; skins installed while the page is open appear after a reload.
