# Agent Note: Black Whale shell backdrop

Status: implemented

English | [中文](2026-08-18-black-whale-shell-backdrop.zh.md)

## Problem

The Web shell had no immediate visual identity beyond neutral semantic surfaces. A user-facing brand backdrop could not live in the conversation tree without competing with the transcript, composer, drag handles, or overlay slots, and copying another client package's logo component into the layout package would violate the client package boundary.

## Decision

The backdrop belongs to the AppFrame shell, and its accent language belongs to the shared theme tokens. AppFrame renders one aria-hidden, pointer-inert layer below the sidebar, conversation, and details columns. The layer carries a web-owned SVG at `apps/web/public/whale.svg`, built from the exact FishLogo path but packaged as a static asset so `ui-layout` does not import `ui-primitives`. The asset renders the whale as a large blue-black silhouette with a saturated blue rim, halo, and flowing current lines; `ui-theme` owns the light and dark `--dsw-specific-black-whale-*` backdrop and accent tokens, while `AppFrame.module.css` owns the deep blue-black gradient, moving current bands, sonar rings, particle field, vignette, and translucent column surfaces.

Readability stays ahead of atmosphere, but the atmosphere is deliberately visible at first paint. The conversation root is transparent so the shell backdrop remains visible in spacing and empty areas. The sidebar uses the same token accents for its divider, icon hover, and primary new-session action; the empty hero uses a gradient headline, glowing fish, and glass chips; the conversation header and active tab carry a restrained blue light track; the composer uses a gradient border and outer glow; user bubbles use a blue-black glass treatment. Sidebar, center, and details columns keep solid fallback backgrounds before their `color-mix()` glass treatments. The decorative layer has no pointer target, sits below the drag handles and shell overlay, and its current, sonar, and particle animations stop under `prefers-reduced-motion: reduce`.

## Alternatives considered

**A full-bleed raster image or video** lost because it would add a heavier asset, make theme adaptation harder, and require a separate reduced-motion path.

**A new client plugin or slot** lost because the backdrop has no live data, owner parameters, or composition need; adding a slot would widen the public composition surface for a decorative shell concern.

**Importing FishLogo into ui-layout** lost because cross-package imports between client plugins are forbidden. The static web asset keeps the exact brand geometry without weakening that rule.

**Making the transcript and composer broadly transparent** lost because the whale would sit directly behind reading and editing surfaces. The shipped design lets the backdrop show through negative space while keeping content surfaces legible.

## Consequences

The first paint now has a prominent DeepSeek black-whale identity in both palettes, with dark mode reading as a deep blue-black mural rather than a faint watermark, and the sidebar, hero, header, composer, and user bubble sharing the same visual system. No slot contract, session event, store, model-visible output, or business behavior changes. Older browsers without `color-mix()` or `backdrop-filter` retain the solid token backgrounds.

`pnpm run test:gui` passed 273 files and 3,786 tests. `DSH_SNAPSHOT=replay pnpm vitest run --config vitest.web.config.ts apps/web/tests/shipped-composition.e2e.ts` passed both composition tests. `pnpm run build` completed and the local Web service was verified to serve the new hashed frontend assets and `/whale.svg`.
