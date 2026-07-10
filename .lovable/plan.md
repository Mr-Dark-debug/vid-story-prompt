# Vidrial — Implementation Plan

Browser-first, AI-assisted video editor. Marketing website + interactive app prototype with mock services. Original premium visual identity, light mode only, WCAG 2.2 AA, TanStack Start + Tailwind v4 + shadcn.

Working name centralised in `src/config/brand.ts` so it can be renamed globally.

---

## Phase 1 — Foundations

- Docs at repo root: `AGENTS.md`, `DESIGN_SYSTEM.md`, `PRODUCT_SPEC.md`, `ROUTES.md`, `ARCHITECTURE.md`, `PRIVACY_MODEL.md`, `CHANGELOG.md`.
- Brand config: name, taglines, copy strings in `src/config/`.
- Design tokens in `src/styles.css` (@theme): warm-neutral palette, single primary accent (deep amber/ink), functional secondary (teal), semantic colours, radii, shadows, motion. Typography pair: display serif (e.g. Fraunces) + neutral sans (Inter) loaded via `<link>` in `__root.tsx`.
- Shared UI in `src/components/ui/*` (shadcn) + product primitives in `src/components/primitives/*` (SectionHeader, Eyebrow, TimelineRibbon logo device, Logo, Prose, Callout, StatusDot, UsageMeter, EmptyState, ErrorState).
- Layouts: `MarketingLayout` (nav, footer, cookie banner), `AppLayout` (sidebar + topbar), `EditorLayout`.
- `/design-system` internal route showcasing tokens + components.

## Phase 2 — Marketing website

Routes under `src/routes/`:
- `/`, `/features`, `/how-it-works`, `/pricing`, `/security`, `/ai-transparency`, `/roadmap`, `/changelog`, `/contact`, `/status`
- `/use-cases` + 5 children (youtube, podcasts, short-form, courses, product-demos)
- `/docs` + children (getting-started, uploading-media, ai-editor, timeline, exporting)
- Legal: `/terms`, `/privacy`, `/cookies`, `/acceptable-use`, `/copyright`, `/imprint`
- Auth: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`
- `sitemap.xml`, `robots.txt`, per-route `head()` metadata.
- Homepage: announcement bar, hero with interactive "editor tile" visual (mock media list + preview + AI chat + plan + timeline strip), principles, workflow, prompt composer with live mock plan swap, feature narrative grouped by phase, uploaded-assets-first search demo, explainable AI operation list, manual control, use cases, pricing preview, security, final CTA.

## Phase 3 — App shell + dashboard + wizard

- Mock auth (`services/auth.ts`) with localStorage session; `_authenticated` layout gate redirecting to `/login?redirect=`.
- Routes: `/app`, `/app/projects`, `/app/projects/new`, `/app/projects/$projectId`, `.../editor`, `.../media`, `.../transcript`, `.../versions`, `.../exports`, `/app/templates`, `/app/uploads`, `/app/usage`, `/app/billing`, settings (profile, preferences, notifications, privacy, integrations), `/app/help`, `/app/feedback`.
- Dashboard: welcome, recent projects with filters/sort, upload status, exports, usage, seeded demo project.
- New-project wizard: 5 steps (details, media add w/ drag-drop mock, organise/tag/roles, brief, review with estimated usage).
- Media library: grid+list, filters, natural-language search (mock), detail drawer.
- Analysis simulation service: staged progress (uploading→ready) with per-file retry, indeterminate where honest.

## Phase 4 — Editor prototype

- Central timeline state module `src/domain/timeline/*`: types, commands (split, trim, ripple-delete, move), history stack, coordinate/time utils. Zustand store scoped per project.
- Editor layout: topbar (project name, save state, undo/redo, versions, aspect, export), resizable left panel (Media/Transcript/Captions/Audio/Brand/Templates tabs), centre preview with mock playback, right AI editor tab, bottom multi-track timeline (SVG/div-based) with playhead, ruler, zoom, snap, selection, waveform placeholders.
- AI editor panel: welcome suggestions, message list, plan cards with per-operation Accept/Reject/Modify/Preview, "Accept all/selected", warnings, usage estimate. Deterministic mock planner that returns different plans based on prompt keywords + selection.
- Transcript editor: virtualised word list, speaker labels, filler/silence markers, edit-text vs exclude-from-timeline distinction with first-time explanation dialog.
- Captions, Audio: forms + presets bound to timeline state.

## Phase 5 — Versions, exports, usage, settings

- Version history: entries created on AI plan apply + manual milestones; compare view (duration/added/removed/moved counts); restore preserves later history.
- Export dialog + job page with simulated state transitions (queued→preparing→rendering→uploading→complete/failed) via timers; copy link, retry, delete, expiry.
- Usage dashboard + billing page (no fake checkout — "Join paid-plan waitlist"), plans + comparison + FAQ.
- Settings incl. privacy: data download stub, project/account deletion confirmations, retention controls, consent switches, sessions/integrations.
- Cookie banner (necessary/optional split, remembered in localStorage).

## Phase 6 — Verification

- A11y pass (focus states, dialog focus trap via Radix, labels, contrast).
- Responsive pass (mobile nav, editor "desktop-first" messaging on <lg with useful review UI).
- Vitest for: timeline commands (split/trim/ripple/undo/redo), plan apply/partial reject, wizard validation, auth guard, export state machine, consent persistence.
- Prod build via harness.

---

## Technical notes

- Stack: TanStack Start (existing), Tailwind v4, shadcn/ui, Radix, Zustand for editor state, TanStack Query for mock async, Zod validation, react-hook-form.
- Services under `src/services/*` with interfaces + `mock` implementations; components consume interfaces so real backends can slot in.
- No secrets, no fake success, all simulated states clearly labelled with `<StatusDot variant="demo">Simulated</StatusDot>` on relevant screens.
- Mock data seeded in `src/mock/seed.ts` incl. "Autumn Roastery Launch" demo project with 12 assets, transcript, one applied version.
- File layout kept small: no single file > ~300 lines; page routes compose sections from `src/components/marketing/*`, `src/components/app/*`, `src/components/editor/*`.

Given the scope (~60 routes, editor prototype, docs), this will be a large multi-turn build. I will proceed phase by phase and report progress after each.
