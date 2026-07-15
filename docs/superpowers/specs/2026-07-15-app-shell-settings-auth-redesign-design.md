# Vidrial application shell, settings, and authentication redesign

Date: 2026-07-15
Status: Approved design

## Objective

Redesign Vidrial's authenticated application shell, settings experience, dashboard framing, and login/signup presentation using the supplied references as structural inspiration without copying their names, colours, branding, or sample data. Every visible control must perform a real action, expose an honest unavailable state, or be omitted.

The result must feel like one product: a calm museum-inspired Vidrial workspace with a persistent navigation frame, clear route context, a real global command/search palette, focused settings forms, and an editorial authentication entrance.

## Source references and interpretation

The three supplied screenshots contribute interaction patterns, not visual assets:

1. The settings reference contributes a dedicated settings navigation rail, clearly grouped controls, concise descriptions, and strong save-state hierarchy.
2. The dashboard reference contributes a persistent sidebar, compact selected states, a top utility row with breadcrumbs and search, and an anchored account area.
3. The authentication reference contributes a split desktop canvas with a branded editorial panel and a focused form panel.

Vidrial retains the identity defined in `docs/BRANDIDENTITY.md`: Vidrial Charcoal, Medium, Cool, and Coral; the shared logo system; the Museum Sans/Manrope stack; restrained motion; and semantic status colours.

## Selected approach

### Considered alternatives

#### Visual-only facelift

This would restyle the current pages while leaving navigation, search, and settings architecture mostly unchanged. It is low risk but would make the top search decorative or page-local and would not solve route context consistently.

#### Unified product shell with federated workspace search

Selected. The existing TanStack routes and server services remain the product boundaries, while shared shell components provide sidebar, breadcrumbs, browser-history controls, and a global command palette. A new server search function queries existing Supabase tables under the current workspace session and RLS.

#### Dedicated indexed search service

A separate search table, full-text index, or vector engine would scale farther but adds migrations, synchronization, cost, and failure modes that are unnecessary at the current product stage. The federated search contract will allow this replacement later without changing the UI.

## Application shell

### Desktop structure

The authenticated product uses two persistent regions:

- A left sidebar, 264 CSS pixels expanded and 76 CSS pixels collapsed.
- A content column containing a sticky utility bar and the route outlet.

The utility bar contains, from left to right:

1. Back and forward buttons that call real browser/TanStack history navigation.
2. Route-aware breadcrumbs.
3. A global search trigger displaying the `Ctrl K` or `⌘ K` shortcut.
4. Space for route-specific actions only when a route genuinely needs them.

Back and forward controls use native history behavior. They remain safe no-ops when no corresponding history entry exists rather than fabricating a destination. Breadcrumb links always navigate to known parent routes.

The content area keeps a readable maximum width for ordinary pages. Media editors and other explicitly wide routes may opt into a wider layout through a shell prop rather than duplicating shell markup.

### Sidebar information architecture

Navigation is grouped without changing route ownership:

- Create: New project.
- Workspace: Overview, YouTube Clipper, Projects, Templates, Uploads.
- Manage: Usage, Billing, Settings.
- Support: Help, Feedback.

The signed-in account block remains anchored at the bottom with provider avatar when available, display name, email, and sign-out action. Empty or missing profile data falls back to a generated initial; no sample identity is displayed.

The current local-storage key, `vidrial-sidebar-collapsed`, continues to persist the desktop preference.

### Collapsed sidebar logo interaction

When the sidebar is collapsed, the top brand slot behaves as one compact control area:

- The standalone Vidrial mark is visible by default.
- Hovering the brand slot reveals the expand-sidebar button in the same position, replacing the mark visually.
- Keyboard focus within the slot reveals the same button, so the interaction is not hover-only.
- The expand button stays in the DOM with the accessible name “Expand sidebar” and has a tooltip for pointer users.
- The transition uses opacity only and respects reduced-motion preferences.
- The mark itself remains a home link only in expanded and mobile branding. In the collapsed reveal slot, the unambiguous primary action is expanding the sidebar.

When the sidebar is expanded, the full Vidrial lockup and the collapse button remain separate, matching the current interaction. The logo remains a link to `/app`; the collapse button remains an independently labelled control.

### Tablet and mobile

- At desktop widths, the persistent sidebar and utility bar are shown.
- From 768 through 1023 CSS pixels, the mobile header and navigation drawer remain in use with tablet spacing; a persistent rail does not consume editor width.
- On mobile, the sidebar becomes a sheet/drawer. The fixed mobile header shows the Vidrial lockup, search trigger, and menu button.
- Mobile search opens as a near-full-screen command dialog.
- Breadcrumbs collapse to the current route plus one parent and truncate safely.
- All targets remain at least 44 CSS pixels high or wide.

## Breadcrumbs and history

A central route metadata map provides human-readable labels and parents for application routes. Static examples include Overview, Projects, Settings, Preferences, and Integrations. Dynamic routes use already-loaded entity names where available, such as a project name, and fall back to a neutral label such as “Project” while loading.

Breadcrumbs use TanStack `Link` components and `aria-current="page"` on the final item. They never expose database identifiers to users. The mapping is shared by the utility bar and command palette navigation results.

## Global command and search palette

### Entry points

The command palette opens from:

- The top search field/trigger.
- `Ctrl K` on Windows/Linux.
- `⌘ K` on macOS.
- The mobile search icon.

`Escape` closes it and returns focus to the trigger. Arrow keys move through results; Enter activates the selected result. The dialog has an accessible title and description.

### Search scope

The search is real and workspace-scoped. It searches:

- Projects: `app_projects.name`, with status and update context.
- Uploads: `media_assets.display_name`, excluding soft-deleted rows.
- Clipping jobs: `clip_jobs.source_title`, with safe status context.
- Settings and product routes: static route labels and keywords.
- Common actions: New project, Create clips, Open uploads, Open integrations, View usage, Help, and Feedback.

The first version does not search transcripts, private source URLs, storage paths, OAuth tokens, filenames that are not already user-visible display names, or analytics payloads.

### Server contract

A dedicated server-only search service accepts a trimmed query of 2–100 characters. It requires the current server-verified session and workspace ID, validates input with Zod, escapes SQL pattern wildcard characters, and performs capped parallel Supabase queries.

Each database query explicitly filters by `workspace_id`; existing RLS remains a second authorization layer. Results are limited per group and projected into a discriminated union containing only:

- result type;
- public entity ID;
- primary label;
- short safe context;
- internal application destination;
- optional icon/status key.

No signed URLs or private media data are returned.

The UI debounces remote queries by approximately 180–250 milliseconds and cancels or ignores stale responses. Static actions are available immediately. Empty queries show common actions rather than fabricated recent records. Queries shorter than 2 characters show guidance without contacting the server.

### Search states

- Initial: common actions grouped by task.
- Loading: compact skeleton rows and `aria-live="polite"` status.
- Results: grouped Projects, Uploads, Clipping jobs, Settings, and Actions.
- Empty: “No workspace results” with useful navigation actions.
- Error: a friendly inline retry state; the palette remains usable for static navigation.

Selecting a result closes the palette, navigates using TanStack Router, and preserves normal browser history.

## Dashboard framing

The dashboard keeps its real loader data for projects, clipping jobs, usage, and current user. Its visual hierarchy is revised to fit the new shell:

- A concise welcome/header block with a real New project action.
- Honest summary cards derived from current project, job, and usage data.
- Recent projects using existing records only.
- Current clipping activity and usage panels.
- Purpose-built empty states for new workspaces.

No trend percentage, chart, activity record, order count, or recent item is invented merely to resemble the reference screenshot. If the application lacks historical series data, it uses totals and progress indicators it can calculate truthfully.

## Settings experience

### Settings shell

`/app/settings` becomes a nested workspace inside the application shell:

- A settings header with breadcrumb context and concise description.
- A left settings navigation rail on desktop.
- A compact section selector on mobile.
- A main content panel with consistent section widths and action placement.

Sections remain separate routes so browser back/forward, deep links, refreshes, and permission boundaries continue to work:

- Profile
- Preferences
- Notifications
- Integrations
- Privacy and data

The rail groups Account, Workspace, Connections, and Security/Data where useful, but it does not display links for unimplemented features.

### Shared settings primitives

Reusable components define consistent behavior:

- `SettingsSection`: title, description, optional status, and action area.
- `SettingRow`: icon, label, description, control, and disabled explanation.
- `SettingsToggle`: accessible switch with visible on/off state.
- `SettingsField`: label, help text, error, and input/select control.
- `SettingsSaveBar`: dirty state, reset/cancel when applicable, loader, success/error feedback.

Controls use current Vidrial tokens, quiet borders, white/cool surfaces, and coral focus/selection. Semantic danger remains red and semantic success remains green.

### Existing operations retained

- Profile updates continue through `updateProfile` and display the Google/provider avatar and verified email where present.
- Email stays read-only until a complete re-verification flow exists; the UI explains this honestly.
- Editor preferences continue through `saveEditorPreferences` and `resetAccountPreferences`.
- Notification preferences continue through `saveNotificationPreferences`.
- YouTube connection, reconnection, publishing permission, automation rule saves, and disconnection continue through existing integration services.
- Data export and account deletion continue through privacy services and retain destructive confirmation.

Forms initialize from route loaders, track dirty state locally, prevent duplicate saves while busy, invalidate router data after successful writes, and show bottom-right toasts plus inline field/section errors where correction is needed.

No unsupported profile-photo upload, currency, locale, device management, password change, or third-party integration is presented as functional. Provider-managed avatar information may be displayed without pretending it can be uploaded locally.

## Authentication redesign

### Desktop layout

Login and signup use the shared `AuthShell` in a split, centred container:

- The left editorial panel uses Vidrial's coral/cool atmosphere, logo, a short product promise, and concise trust points relevant to private media workflows.
- The right panel contains the actual authentication form and all required verification states.

The panel is branded through CSS and existing logo assets, not copied artwork or downloaded stock imagery. Decorative elements are hidden from assistive technology.

### Form behavior

Existing behavior remains authoritative:

- Google OAuth.
- Email/password login and signup.
- Password visibility controls.
- Redirect preservation.
- Persistent Supabase sessions.
- Visible Cloudflare Turnstile verification before signup actions are enabled.
- Loading labels and duplicate-submit prevention.
- Friendly inline errors and accessible status announcements.

The Google action remains prominent, followed by an accessible divider and email flow. Login and signup link to each other and preserve safe redirect parameters.

### Responsive behavior

On mobile, the editorial panel collapses to compact branded context above the form. The form is never horizontally squeezed, primary actions remain reachable without precision tapping, and Turnstile does not overflow. The layout supports narrow 320 CSS pixel viewports without horizontal scrolling.

## Data flow and component boundaries

- Route loaders own initial server data.
- Route components compose page-level sections.
- Shared shell components own navigation presentation only.
- Search persistence and queries live in a server service, not in the sidebar or route components.
- Existing settings/auth/integration services remain responsible for mutations.
- React Query or the existing router invalidation pattern handles refresh after mutations; no duplicate client data store is introduced.

The shell must not access service-role credentials, raw OAuth tokens, signed media URLs, transcripts, or worker internals.

## Error handling and loading

- Route-level loading uses stable skeletons that preserve page geometry.
- Search loading uses cancellable/debounced requests and ignores stale results.
- Save buttons show action-specific loading text.
- Inline messages explain recoverable field issues.
- Bottom-right toasts confirm completed mutations or surface non-field failures.
- Destructive operations retain confirmation dialogs and cannot be triggered by a single accidental click.
- Network failures do not erase unsaved form state.

## Accessibility and interaction quality

- Every icon-only action has an accessible name and tooltip where helpful.
- Sidebar hover behavior has equivalent keyboard focus behavior.
- Navigation uses links; mutations use buttons.
- Dialogs contain titles and descriptions.
- Focus returns to the initiating control after closing overlays.
- Selected sidebar items and settings sections expose `aria-current="page"`.
- Switches expose checked state and share a full-row label target.
- Focus rings use Vidrial Coral with sufficient offset/contrast.
- Motion uses opacity/transform only and respects `prefers-reduced-motion`.

## Verification plan

### Unit and component tests

- Sidebar expanded/collapsed rendering, local-storage persistence, hover/focus reveal structure, and accessible names.
- Breadcrumb generation for static and dynamic routes.
- Command palette keyboard behavior, grouped states, empty/loading/error states, and focus restoration.
- Settings primitives and dirty/save/reset behavior.
- Auth split shell at login/signup and visible Turnstile gating.

### Server tests

- Search input validation.
- Workspace scoping and unauthenticated rejection.
- Result projection excludes secret/private fields.
- Soft-deleted media is excluded.
- Per-group result limits and safe destinations.

### End-to-end and visual checks

- Desktop expanded and collapsed sidebar.
- Pointer hover and keyboard focus reveal of the collapsed expand control.
- Back, forward, breadcrumb, and result navigation.
- `Ctrl/Cmd K`, keyboard result selection, and mobile search.
- Profile, preferences, notifications, integration, export, and destructive confirmation flows with test-safe fixtures.
- Login, signup, Google redirect initiation, Turnstile visibility, error states, and persistent session redirects.
- Desktop, tablet, 390 CSS pixel, and 320 CSS pixel layouts.
- No horizontal overflow, hydration errors, missing dialog titles, or browser console errors.

The full repository quality suite remains required: application typecheck, lint, tests and build; worker typecheck, tests and build; relevant Playwright and Supabase integration tests; production deployment verification.

## Acceptance criteria

1. The application has one coherent responsive shell with a persistent/collapsible sidebar and sticky utility bar.
2. The collapsed Vidrial mark reveals the expand control on pointer hover and keyboard focus; expanded mode keeps logo and collapse control separate.
3. Breadcrumbs and browser back/forward controls navigate real routes.
4. Global search returns authorized projects, uploads, clipping jobs, settings, and actions and never leaks private fields.
5. Settings routes use the new nested design while every existing mutation remains functional and honestly represented.
6. Login and signup use the split Vidrial design without regressing OAuth, Turnstile, validation, redirects, or session persistence.
7. Empty workspaces show intentional empty states and no fabricated records.
8. Desktop and mobile layouts pass accessibility, responsiveness, console, and automated test verification.

## Out of scope

- A separate search SaaS, vector database, or transcript-wide semantic search.
- New billing functionality, password-change flow, locale/currency system, device management, or unsupported integrations.
- Copying the reference brands, colours, product names, charts, sample records, or artwork.
- Changing clipping authorization, YouTube media rules, worker processing, entitlements, or server-side watermark decisions.
