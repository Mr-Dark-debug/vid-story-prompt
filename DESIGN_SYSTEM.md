# Vidrial Design System

A warm, editorial, light-first design language. All tokens live in
`src/styles.css` and are consumed via Tailwind utilities. Never hardcode
colors — use the semantic tokens.

## Principles

1. **Editorial, not techy.** Serif display type (Fraunces) paired with a
   humanist sans (Inter). Generous whitespace. Content leads.
2. **Warm neutrals.** Off-white surfaces, ink-dark text, ember accent. No
   pure black or pure white in UI chrome.
3. **Explainable motion.** Micro-interactions clarify state; never decorate.
4. **Accessible by default.** WCAG 2.2 AA contrast, focus rings on every
   interactive element, 44px minimum touch targets.

## Color tokens (OKLCH)

| Token | Role |
| --- | --- |
| `--surface-page` | Page background (warm off-white) |
| `--surface-panel` | Elevated card / panel |
| `--surface-sunken` | Inputs, muted wells |
| `--ink` | Primary text |
| `--ink-soft` | Secondary text |
| `--ink-mute` | Tertiary / captions |
| `--line` / `--line-strong` | Hairlines & borders |
| `--ember` / `--ember-ink` | Primary accent (warm coral) |
| `--teal` | Secondary accent |
| `--success` / `--warning` / `--danger` | Status |

Utility classes: `bg-surface-page`, `text-ink`, `border-line`, `text-ember-ink`, etc.

## Typography

- **Display**: Fraunces (serif). Used for h1–h3, hero headlines.
- **Body**: Inter (sans). Used for prose, UI copy, buttons.
- **Mono**: JetBrains Mono. Used only for code and timecode.

Scale: `text-xs` (12) · `text-sm` (14) · `text-base` (16) · `text-lg` (18) ·
`text-xl` (20) · `text-2xl` (24) · `text-3xl` (30) · `text-4xl` (36) ·
`text-5xl` (48) · `text-6xl` (60).

## Spacing & radius

4px base grid. Prefer `rounded-lg` (8), `rounded-2xl` (16), `rounded-3xl` (24)
for cards. Buttons use `rounded-lg`.

## Primitives (`src/components/primitives/`)

- `Logo` — brand mark
- `Section` — vertical rhythm wrapper
- `StatusDot` — colored dot for status pills
- `TimelineRibbon` — decorative timeline motif
- `EmptyState` — icon + heading + CTA
- `UsageMeter` — quota bar

## Live reference

Visit `/design-system` in the running app for rendered tokens, type scale,
status dots, and primitives.
# Vidrial design system

Vidrial uses a warm editorial canvas, ink typography, deep ember primary actions and functional teal. Reuse semantic tokens from `src/styles.css`, Fraunces display type, Inter body type, JetBrains Mono for timing/scores, 12–24 px rounded surfaces and restrained borders. Status must include text or icons, never colour alone. YouTube Clipper uses a documentary contact-sheet motif while remaining within these tokens.

Interactive controls require visible focus, 44 px touch targets where practical, labelled fields, semantic progress announcements and reduced-motion fallbacks. Desktop may show the full timeline; mobile uses focused timing/caption panels instead of compressing the desktop editor.
