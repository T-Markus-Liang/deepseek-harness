# @deepseek-ai/dsh-client-ui-skin-switcher

English | [中文](README.zh.md)

Theme skin switcher: lists installed theme skins in Settings and toggles the active one.

## What it is

The web GUI's built-in theme offers light / dark / system only. Third-party
skin packages (like `dsh-deep-whale#maid-atelier`) ship their own
`skin.json` manifest and activate by setting a body attribute
(`bodyAttr`, e.g. `data-dsh-maid-atelier`) that gates their entire
stylesheet. Installing several skins makes every one of them activate at
once — their CSS conflicts.

This plugin gives the user a Settings section ("主题皮肤") that lists every
installed skin and keeps exactly one active:

- **List**: the host scans profile `node_modules` for packages carrying a
  `skin.json` and serves them via `GET /dsh-skins`.
- **Switch**: the browser half removes every known skin's `bodyAttr` from
  `<body>` and sets only the chosen one, then persists the choice via
  `POST /dsh-skins/activate` (written to `<profile>/dsh-skins.json`).
- **Restore**: on page load the browser half re-applies the persisted
  choice, overriding the skins' own unconditional auto-activation.

## Host routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/dsh-skins` | GET | List `{ skins, active }` |
| `/dsh-skins/activate` | POST | Persist `{ id }` (or `null` for the default look) |

The activate route rejects cross-origin POSTs and unknown skin ids.

## Model Experience

None, as the package is a settings row that toggles body attributes; nothing it does reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- Switching is a body-attribute swap, not a bundle unmount: an inactive
  skin's injected decorative DOM nodes stay in the page (their styles are
  gated off, so they are invisible). A future revision could hide them
  explicitly.
- The list is populated at Settings mount; installing a skin while the
  page is open requires a reload to appear.
