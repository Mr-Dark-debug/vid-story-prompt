# Vidrial brand identity

This document is the production usage guide for Vidrial's visual identity. The designer board at `docs/BRANDIDENTITY.jpg` and its supplied logo exports are the visual source of truth. The application implementation lives in `src/components/primitives/logo.tsx` and `src/styles.css`.

## Brand character

Vidrial is a calm, precise creative tool. Its identity is timeless, museum-inspired, editorial, architectural, and confident. Product screens should feel considered and spacious, never loud or gimmicky. The split portal/V symbol is the most recognisable element; colour and typography support it rather than compete with it.

Use strong hierarchy, generous negative space, cool-neutral fields, and direct language. Avoid generic AI imagery, purple technology gradients, excessive glow, glass effects, decorative sparkles, and dense colour usage.

## Logo assets

Designer references:

- `docs/LOGODARK.png` — dark standalone mark
- `docs/DARKLOGOWITHTEXT.png` — dark horizontal lockup
- `docs/logolight.png` — light standalone mark
- `docs/lightlogowithtext.png` — light horizontal lockup

These PNG files contain baked checkerboard pixels and are not transparent. Never import them directly into application UI, emails, exports, or social assets. Use the shared production SVG component:

```tsx
import { Logo, LogoMark } from "@/components/primitives/logo";

<Logo />
<Logo tone="light" />
<Logo variant="mark" />
<LogoMark tone="dark" />
```

The static browser icon is `public/favicon.svg` and uses the same geometry.

## Choosing a variant

| Situation                   | Variant                                      | Tone             |
| --------------------------- | -------------------------------------------- | ---------------- |
| Marketing navigation        | Horizontal lockup                            | Dark             |
| Authentication              | Horizontal lockup                            | Dark             |
| Expanded app sidebar        | Horizontal lockup                            | Dark             |
| Collapsed app sidebar       | Standalone mark                              | Dark             |
| Charcoal footer             | Horizontal lockup, tagline allowed           | Light            |
| Dark video or media surface | Standalone mark                              | Light            |
| Favicon or compact app icon | Standalone mark in charcoal container        | Light            |
| Spacious campaign lockup    | Horizontal or stacked lockup with descriptor | Match background |

Use the descriptor “AI-assisted video editing” only where there is enough room to read it. Do not place it in compact navigation.

## Spacing and minimum size

- Keep clear space of at least one quarter of the mark height on every side.
- Do not render the standalone mark below 20 CSS pixels.
- Do not render the horizontal lockup below 96 CSS pixels wide.
- Preserve the original aspect ratio and alignment.
- Keep the mark optically aligned with adjacent type, not merely box-centred.

## Approved colours

| Name             | Hex       | Use                                                    |
| ---------------- | --------- | ------------------------------------------------------ |
| Vidrial Charcoal | `#1D1D1B` | Primary type, dark surfaces, dark artwork              |
| Vidrial Medium   | `#787C7F` | Secondary information and functional neutral           |
| Vidrial Cool     | `#B5BCC4` | Dividers, inactive states, supporting fields           |
| Vidrial Coral    | `#EF8668` | Primary actions, focus, selection, controlled emphasis |

Supporting white and near-white canvas colours are allowed. Coral is an accent, not a page background or body-text colour. Dark text is used on coral controls because white does not meet appropriate contrast at this coral value. Success, warning, danger, and information colours remain semantic and must not be replaced with brand coral.

New UI must use semantic tokens from `src/styles.css`; do not scatter raw brand hex values through components. Raw values are acceptable only in the design-system reference, static metadata, and the favicon.

## Typography

The brand board specifies Museum Sans. It is a commercial font. Do not download, commit, or redistribute it without licensed webfont files supplied by the owner.

The production stack is:

1. Museum Sans, when installed through licensed WOFF2 files.
2. Manrope, the approved license-safe web fallback.
3. System sans-serif fallback.

JetBrains Mono is reserved for timestamps, identifiers, technical values, and editing timecodes. Headings are sans-serif, medium through extra-bold, with tight tracking. Do not reintroduce serif display typography.

## Background and contrast rules

- Use dark artwork on white, near-white, or sufficiently pale cool-neutral backgrounds.
- Use light artwork on Charcoal, Medium, or sufficiently dark media.
- Use a solid quiet field behind the logo when media is visually busy.
- All interactive text and controls must continue to meet WCAG AA contrast.
- The logo is not a watermark entitlement control; worker-rendered watermarks remain governed by server-side plan rules.

## Never do this

- Do not stretch, squash, rotate, skew, crop, or rearrange the mark.
- Do not redraw the symbol, change its notch, or alter its diagonal relationship.
- Do not outline it, add drop shadows, gradients, glow, texture, or animation inside it.
- Do not recolour it outside the approved dark and light treatments.
- Do not place it over low-contrast or noisy imagery without a quiet container.
- Do not use the baked-checkerboard PNG references in production.
- Do not create page-specific logo components or hard-code a different wordmark font.

## Agent checklist

Before completing brand-related work:

1. Use `Logo` or `LogoMark`; never create a local logo copy.
2. Use semantic design tokens and keep coral restrained.
3. Check light and dark contrast plus desktop and mobile sizing.
4. Confirm the expanded and collapsed app sidebar retain a brand identifier.
5. Verify navigation, authentication, footer, metadata, and favicon when relevant.
6. Run typecheck, lint, tests, build, and browser visual checks.
7. Update this document whenever an approved source asset or rule changes.
