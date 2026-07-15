# Vidrial application shell, settings, and authentication implementation plan

Source specification: `docs/superpowers/specs/2026-07-15-app-shell-settings-auth-redesign-design.md`

## Phase 1: shared navigation and search contracts

1. Add route metadata for application breadcrumbs, settings sections, command actions, and destination labels.
2. Add a server-only workspace search service with Zod validation, escaped `ilike` queries, explicit workspace filters, capped parallel project/media/job queries, and a safe discriminated result type.
3. Add unit tests for input bounds, wildcard escaping, result projection, workspace filtering, soft-deleted media exclusion, and private-field omission.
4. Add shared breadcrumb/history controls and a keyboard-accessible command palette with debouncing, loading, empty, error, action, and grouped-result states.

## Phase 2: authenticated application shell

1. Refactor `AppLayout` into focused sidebar, topbar, breadcrumb, search-trigger, and account components without changing route ownership.
2. Group existing navigation into Create, Workspace, Manage, and Support while preserving every current destination.
3. Preserve the desktop collapsed preference and implement the collapsed brand slot: logo by default, expand control on pointer hover or keyboard focus, and separate lockup/collapse controls while expanded.
4. Keep mobile/tablet navigation in an accessible drawer and expose search from the mobile header.
5. Add shell tests for accessible navigation, persisted collapsed state, hover/focus reveal structure, mobile controls, and sign-out loading/error behavior.

## Phase 3: dashboard and settings workspace

1. Restyle the dashboard using only real loader data, truthful summary cards, recent projects, usage, clipping activity, and intentional empty states.
2. Replace horizontal settings tabs with a desktop settings rail and mobile section selector while keeping separate deep-linkable routes.
3. Add reusable settings section, row, field, switch, and action components with consistent labels, descriptions, dirty states, loaders, inline errors, and toast feedback.
4. Migrate Profile, Preferences, Notifications, Integrations, and Privacy/Data pages to the shared system without changing their server mutation boundaries.
5. Add route/component tests for settings navigation and each existing save, reset, export, connection, disconnection, automation, and destructive confirmation flow that can be exercised safely.

## Phase 4: authentication presentation

1. Refactor the shared authentication shell into a responsive split desktop layout with a Vidrial editorial brand panel and focused form panel.
2. Preserve Google OAuth, email/password flows, safe redirects, password visibility, loaders, inline errors, persistent sessions, and visible Turnstile gating.
3. Add compact mobile branding and verify 320/390 CSS pixel layouts without Turnstile or form overflow.
4. Update authentication component and Playwright coverage for login, signup, OAuth initiation, verification gating, error states, and navigation between auth routes.

## Phase 5: verification and delivery

1. Run Prettier, application typecheck, lint, unit/integration tests, production build, worker typecheck/tests/build, and the relevant Playwright suite.
2. Review changed UI against React and current Web Interface Guidelines, including focus, dialog semantics, keyboard navigation, reduced motion, touch targets, and long-content handling.
3. Browser-test the real app at desktop, tablet, 390 CSS pixels, and 320 CSS pixels; inspect expanded/collapsed sidebar, command search, settings, login/signup, loaders, empty states, and console output.
4. Scan the staged diff for secrets and ensure `src/routeTree.gen.ts` is changed only through normal TanStack generation if route changes require it.
5. Commit coherent buildable changes without rewriting Lovable history, push normally to `main`, wait for Vercel production, inspect deployment/runtime logs, and verify the canonical production URL.
