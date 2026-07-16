# Connector marquee and dropdown design

## Goal

Replace the decorative homepage timeline ribbon with an understated moving presentation of the real Vidrial connector catalog, and make the supplied Radix dropdown-menu foundation the shared implementation behind every `SelectField` control.

## Connector marquee

- The catalog comes only from `CONNECTOR_REGISTRY`; marketing code does not keep a second connector list.
- Each item uses `ConnectorIcon`, including the provider image assets already committed for brands without a suitable icon-library glyph.
- The marquee follows a shallow SVG curve, hides the path itself, pauses/slows on hover, and honours reduced-motion preferences.
- Connector chips use quiet white/cool surfaces, compact labels, and semantic Vidrial tokens. Availability is expressed in accessible text, not a decorative status colour.
- Repeated animation copies are hidden from assistive technology; one semantic copy remains available.
- The implementation is responsive and does not rely on remote images.

## Shared dropdown

- `src/components/ui/dropdown-menu.tsx` is the shared Radix primitive and adopts the supplied focus-restoration handling.
- `SelectField` keeps its existing controlled API (`value`, `onValueChange`, `options`, `name`, descriptions, badges, and disabled choices), so every current call site migrates together.
- A hidden input preserves form submission behavior when `name` is provided.
- Locked plan choices remain visible and disabled, while the selected value is clearly marked.
- The menu uses keyboard-operable radio-item semantics, restrained motion, semantic tokens, and a consistent menu width matched to its trigger.

## Verification

- Focused unit tests cover selection, form values, and disabled options.
- A connector-marquee test proves that the visible catalog is registry-driven.
- Typecheck, lint, app tests, production build, and worker tests must pass.
- Final desktop and mobile checks are performed with the user's Chrome session, followed by deployment to the existing Vercel production project.
