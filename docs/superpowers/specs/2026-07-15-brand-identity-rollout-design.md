# Vidrial brand identity rollout design

Date: 2026-07-15

## Objective

Translate the supplied designer board and logo files into a consistent, production-safe identity across Vidrial's marketing site, authentication flow, application shell, metadata, and internal design-system reference. The rollout changes presentation only; routing, authorization, persistence, clipping, worker, and integration behavior remain unchanged.

## Source of truth

The supplied `docs/BRANDIDENTITY.jpg` is the visual authority. The original logo exports remain in `docs/` as designer references:

- `LOGODARK.png`: dark standalone mark
- `DARKLOGOWITHTEXT.png`: dark horizontal lockup
- `logolight.png`: light standalone mark
- `lightlogowithtext.png`: light horizontal lockup

The PNG exports contain a baked checkerboard and are RGB images without transparency. They must not be embedded directly in product UI. Production assets will be clean SVG translations of the supplied geometry so the mark stays sharp, accessible, and free of checkerboard artifacts at every size.

## Brand direction

Vidrial is restrained, editorial, architectural, and confident. The identity should feel closer to a museum publication or a well-made creative tool than a generic AI product. The memorable element is the divided portal/V mark: a compact symbol that suggests selection, framing, and movement through media.

The interface uses quiet neutral fields, strong charcoal type, precise spacing, and coral only where attention or action is required. It avoids decorative gradients, excessive glow, multicolour AI tropes, and ad-hoc logo treatments.

## Considered approaches

### 1. Use the supplied PNGs directly

Fastest, but rejected because the checkerboard is embedded in every export, raster edges soften at small and high-density sizes, and light/dark adaptation is unreliable.

### 2. Clean the PNGs into transparent raster files

Better than direct use, but thresholding can damage edge antialiasing and still leaves multiple raster sizes to maintain.

### 3. Translate the supplied geometry into a central SVG system

Selected. A single React component exposes mark and lockup modes plus dark and light tones. A matching static favicon SVG uses the same geometry. This provides exact sizing, semantic colour control, accessibility, and one implementation source while retaining the designer exports as references.

## Logo system

`LogoMark` renders only the symbol. `Logo` renders either the horizontal lockup or the mark and links to the appropriate home route.

- Horizontal dark lockup: marketing navigation, light authentication surfaces, light footer variants, and expanded application sidebar.
- Horizontal light lockup: dark footer or dark media surfaces.
- Dark symbol: collapsed sidebar, compact controls, favicon on light browser surfaces, and small product identifiers.
- Light symbol: dark media overlays and dark icon containers.
- Tagline lockups are reserved for spacious brand or campaign surfaces and must not be squeezed into navigation.

The link receives the accessible name; decorative logo SVGs remain hidden from assistive technology. Clear space is at least one quarter of the mark height on every side. The symbol must not render below 20 CSS pixels; the horizontal lockup must not render below 96 CSS pixels wide.

## Colour system

Canonical colours sampled from the board:

| Token            | Hex       | Role                                                  |
| ---------------- | --------- | ----------------------------------------------------- |
| Vidrial Charcoal | `#1D1D1B` | Primary text, dark surfaces, dark logo                |
| Vidrial Medium   | `#787C7F` | Secondary text and functional neutral                 |
| Vidrial Cool     | `#B5BCC4` | Dividers, cool supporting fields, inactive states     |
| Vidrial Coral    | `#EF8668` | Primary action, focus, selection, controlled emphasis |

White and near-white may be used as supporting canvas colours. Existing semantic success, warning, danger, and info colours remain functional and must not be replaced by brand coral when that would obscure meaning. Existing semantic token names such as `ember` can remain as compatibility aliases, but documentation and new code refer to their brand roles rather than the retired visual name.

## Typography

The board specifies Museum Sans. Museum Sans is commercial and no licensed webfont files are included, so the application must not download, bundle, or imitate an unlicensed copy. The CSS stack lists `Museum Sans` first for licensed installations, followed by the license-safe `Manrope` webfont and system sans fallbacks. Display styles use medium-to-bold weights, tight but readable tracking, and no serif styling. JetBrains Mono remains for technical values.

When licensed Museum Sans WOFF2 files are supplied, they can be added through `@font-face` without changing component code.

## Surface migration

- Global semantic tokens move from warm paper, ember, and teal to cool neutrals, charcoal, and coral.
- Navigation receives the horizontal logo and quieter editorial spacing.
- Authentication keeps a focused card layout but uses neutral depth and a controlled coral atmosphere.
- The expanded application sidebar uses the lockup; the collapsed state uses the standalone symbol so branding never disappears.
- The marketing footer becomes charcoal and uses the inverted lockup for a deliberate closing brand moment.
- The internal design-system page documents logo variants, palette roles, typography, and misuse rules.
- Root metadata uses the SVG favicon and the canonical theme colour.

## Documentation for agents

`docs/BRANDIDENTITY.md` becomes the durable implementation guide. `AGENTS.md` links to it and requires contributors to use the shared logo component and semantic tokens. The designer board and exports remain checked into `docs/` as reference material.

## Verification

- Unit tests cover logo modes, accessible naming, and tone variants.
- Typecheck, lint, application tests, and production build must pass.
- Worker type/tests/build are run to confirm presentation changes do not affect the processing service.
- Browser verification covers desktop and mobile marketing, authentication, expanded and collapsed app navigation where an authenticated fixture is available, favicon, contrast, overflow, and responsive lockup sizing.
- The production deployment is checked after push; deployment or authenticated-flow success is reported only when directly observed.

## Out of scope

- Changing product copy, plans, application workflows, database schema, authentication behavior, worker processing, or provider integrations.
- Redistributing Museum Sans without a valid licence.
- Rebuilding the designer board or replacing the supplied mark with an AI-generated logo.
