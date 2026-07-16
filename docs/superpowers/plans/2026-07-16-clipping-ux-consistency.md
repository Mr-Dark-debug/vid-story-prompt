# Clipping UX Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a tier-aware clipping flow, consistent selects and dialogs, resilient YouTube previews, safe job deletion, and a direct responsive authentication layout.

**Architecture:** Existing Radix primitives remain the accessibility foundation. Small focused wrappers provide Vidrial styling and typed product behaviour, while server-side Supabase enforcement stays authoritative. The clipping wizard receives current entitlement context from its route loader and translates known RPC failures into structured dialog states.

**Tech Stack:** React 19, TypeScript, TanStack Start/Router, Radix UI, Tailwind semantic tokens, Supabase/PostgreSQL, Vitest, Testing Library, Playwright.

## Global Constraints

- Preserve server-verified Supabase sessions, workspace RLS, transactional usage, and worker-derived entitlements.
- Keep action menus, command palettes, and the searchable source directory on their specialised primitives; replace native single-value `<select>` elements only.
- Free supports 5 clips per job, Creator 20, and Pro 50; the database remains the source of truth.
- Do not expose raw backend error codes, service-role credentials, private URLs, filenames, or transcripts.
- Use Vidrial semantic tokens, Manrope fallback, and `src/components/primitives/logo.tsx` according to `docs/BRANDIDENTITY.md`.
- Use normal commits and pushes; never force-push, rebase, amend, or squash published Lovable history.

---

### Task 1: Reusable Vidrial select field

**Files:**
- Modify: `src/components/ui/select.tsx`
- Create: `src/components/ui/select-field.tsx`
- Create: `src/components/ui/select-field.test.tsx`

**Interfaces:**
- Consumes: existing Radix `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, and Vidrial semantic tokens.
- Produces: `SelectFieldOption` and `SelectField` with `value`, `onValueChange`, `options`, `label`, `hint`, `placeholder`, `disabled`, `name`, and `className`.

- [ ] **Step 1: Write the failing select-field tests**

```tsx
render(
  <SelectField
    label="Requested clips"
    value="5"
    onValueChange={onChange}
    options={[
      { value: "5", label: "5 clips" },
      { value: "10", label: "10 clips", badge: "Creator", disabled: true },
    ]}
  />,
);
expect(screen.getByRole("combobox", { name: "Requested clips" })).toBeEnabled();
await user.click(screen.getByRole("combobox"));
expect(screen.getByRole("option", { name: /10 clips Creator/ })).toHaveAttribute("data-disabled");
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- --run src/components/ui/select-field.test.tsx`

Expected: FAIL because `SelectField` does not exist.

- [ ] **Step 3: Implement the typed wrapper and polish the primitive**

```ts
export type SelectFieldOption = {
  value: string;
  label: string;
  badge?: string;
  description?: string;
  disabled?: boolean;
};

export type SelectFieldProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectFieldOption[];
  hint?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  className?: string;
};
```

Use a generated id to connect the visible label to the trigger. Render option badges inside the item text, retain Radix keyboard navigation, and style the trigger/content with `border-line`, `bg-surface-page`, `bg-surface-panel`, `text-ink`, `text-ink-mute`, and `focus-visible:ring-ember`.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -- --run src/components/ui/select-field.test.tsx && npm run typecheck`

Expected: select tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit**

```powershell
git add src/components/ui/select.tsx src/components/ui/select-field.tsx src/components/ui/select-field.test.tsx
git commit -m "feat: add reusable Vidrial select field"
```

### Task 2: Migrate all native value selects

**Files:**
- Modify: `src/routes/contact.tsx`
- Modify: `src/components/youtube-clipper/youtube-publish-panel.tsx`
- Modify: `src/components/youtube-clipper/job-wizard.tsx`
- Modify: `src/components/youtube-clipper/clip-editor.tsx`
- Modify: `src/routes/_authenticated.app.billing.tsx`
- Modify: `src/routes/_authenticated.app.projects.index.tsx`
- Modify: `src/routes/_authenticated.app.projects.$projectId.index.tsx`
- Modify: `src/routes/_authenticated.app.settings.preferences.tsx`
- Modify: `src/routes/_authenticated.app.settings.integrations.tsx`
- Modify: `src/routes/_authenticated.app.settings.tsx`

**Interfaces:**
- Consumes: `SelectField` from Task 1.
- Produces: zero native `<select>` elements under `src/` and unchanged state values/server payloads.

- [ ] **Step 1: Record the migration guard**

Run: `rg -n "<select|</select>" src --glob '*.tsx'`

Expected before migration: 17 opening tags across 10 files.

- [ ] **Step 2: Replace each select using exact value mappings**

Use these option sources without changing payload values:

| File | Field | Options |
| --- | --- | --- |
| `contact.tsx` | topic | existing contact topic values |
| `youtube-publish-panel.tsx` | privacy, playlist | current privacy and playlist values |
| `job-wizard.tsx` | language, content type, duration, caption preset | current option strings |
| `clip-editor.tsx` | aspect ratio, captions | current editor values |
| billing route | plan interest | creator, pro, business |
| projects routes | status/filter/sort/version controls | current route values |
| settings preferences | locale/time zone choice | current values |
| settings integrations | automation cadence/content/status | current values |
| settings route | workspace settings choice | current values |

For form-submitted pages, pass `name` to Radix Select so hidden form values are preserved. For controlled state, replace `onChange={(event) => setValue(event.target.value)}` with `onValueChange={setValue}`.

- [ ] **Step 3: Verify no native selects remain**

Run: `rg -n "<select|</select>" src --glob '*.tsx'`

Expected: no matches.

- [ ] **Step 4: Run relevant suites**

Run: `npm run typecheck && npm test -- --run src/components/youtube-clipper src/routes`

Expected: exit 0.

- [ ] **Step 5: Commit**

```powershell
git add src
git commit -m "refactor: standardize application selects"
```

### Task 3: Reusable status dialogs and typed clipping errors

**Files:**
- Create: `src/components/ui/status-dialog.tsx`
- Create: `src/components/ui/status-dialog.test.tsx`
- Create: `src/components/youtube-clipper/job-error.ts`
- Create: `src/components/youtube-clipper/job-error.test.ts`
- Modify: `src/components/ui/dialog.tsx`
- Modify: `src/components/ui/alert-dialog.tsx`

**Interfaces:**
- Produces: `StatusDialogVariant = "success" | "pending" | "warning" | "error" | "plan-limit"`; `StatusDialog`; `ConfirmationDialog`; `classifyClipJobError(cause, context): ClipJobErrorPresentation`.

- [ ] **Step 1: Write failing dialog and error-mapping tests**

```ts
expect(classifyClipJobError(new Error("plan_limit_exceeded"), {
  plan: "free",
  maxClips: 5,
  requestedClips: 10,
})).toMatchObject({
  kind: "plan-limit",
  title: "Free supports up to 5 clips per job",
  recoverValue: 5,
});

expect(classifyClipJobError(new Error("concurrent_job_limit_exceeded"), context).description)
  .toContain("one active clipping job");
```

Render tests assert dialog title/description, primary/secondary actions, Escape close behaviour where allowed, focus trapping, and destructive confirmation labelling.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- --run src/components/ui/status-dialog.test.tsx src/components/youtube-clipper/job-error.test.ts`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the reusable dialog presentation**

`StatusDialog` accepts `open`, `onOpenChange`, `variant`, `title`, `description`, `detail`, `primaryAction`, and `secondaryAction`. Use a soft variant-tinted glow only in the icon/header zone, a white/semantic panel body, responsive stacked actions on small screens, and visible focus states. `ConfirmationDialog` accepts `confirmLabel`, `cancelLabel`, `busy`, `destructive`, and async-safe callbacks.

- [ ] **Step 4: Implement deterministic error classification**

Map exact service codes before the generic `userFacingError` fallback. Never return the raw code. Include actions for usage, jobs, and billing destinations without claiming checkout exists.

- [ ] **Step 5: Run tests**

Run: `npm test -- --run src/components/ui/status-dialog.test.tsx src/components/youtube-clipper/job-error.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/components/ui src/components/youtube-clipper/job-error.ts src/components/youtube-clipper/job-error.test.ts
git commit -m "feat: add reusable status dialogs"
```

### Task 4: Tier-aware clipping workflow and simplified YouTube preview

**Files:**
- Modify: `src/services/clipping/server.ts`
- Modify: `src/routes/_authenticated.app.youtube-clipper.new.tsx`
- Modify: `src/components/youtube-clipper/job-wizard.tsx`
- Modify: `src/components/youtube-clipper/job-wizard.test.tsx`
- Create: `src/components/media/resilient-thumbnail.tsx`
- Create: `src/components/media/resilient-thumbnail.test.tsx`

**Interfaces:**
- Produces: `getClipJobCreationContext()` returning `{ plan, entitlement, usage, activeJobs }`; `ResilientThumbnail`; tier-aware `JobWizard` props.

- [ ] **Step 1: Write failing entitlement and thumbnail tests**

Test Free option states: 1–5 enabled; 10, 20, and 50 disabled with plan badges. Test Creator: through 20 enabled; 50 disabled. Test Pro: all enabled. Test a 10-clip Free error opens the plan-limit dialog, and “Use 5 clips” updates the selection and closes the dialog.

For thumbnails, fire an `error` event on the metadata URL and expect the image source to become `https://i.ytimg.com/vi/<videoId>/hqdefault.jpg`; fire another error and expect the neutral placeholder without a broken image.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- --run src/components/youtube-clipper/job-wizard.test.tsx src/components/media/resilient-thumbnail.test.tsx`

Expected: FAIL on missing tier props and thumbnail fallback.

- [ ] **Step 3: Add server-provided creation context**

Use `getCurrentSession`, `getPlanEntitlement`, current `usage_periods`, and active `clip_jobs` count. Return numeric usage fields only; do not expose private records.

- [ ] **Step 4: Replace clip-count number input with tier-aware `SelectField`**

Build options from `[1, 2, 3, 4, 5, 10, 20, 50]`. Determine the first unlocking plan from `PLAN_ENTITLEMENTS`. Disable values greater than `entitlement.maxClipsPerJob` and show the plan badge.

- [ ] **Step 5: Simplify the YouTube source presentation**

Remove the repeated YouTube header/availability/description, automation link, views/likes/quality/published statistics, and worker-import callout. Render a compact preview with `ResilientThumbnail`, title, channel, and formatted duration. Retain URL loading state and rights confirmation.

- [ ] **Step 6: Use status dialogs for submit failures**

Before calling the server, use `evaluateJobEntitlement` with loader context. For recoverable clip limits, open the plan dialog. For server failures, call `classifyClipJobError`. Keep inline field errors only for malformed/missing input.

- [ ] **Step 7: Run focused tests and typecheck**

Run: `npm test -- --run src/components/youtube-clipper/job-wizard.test.tsx src/components/media/resilient-thumbnail.test.tsx src/domain/clipping && npm run typecheck`

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/services/clipping/server.ts src/routes/_authenticated.app.youtube-clipper.new.tsx src/components/youtube-clipper src/components/media
git commit -m "fix: make clipping limits clear and actionable"
```

### Task 5: Safe clipping-job deletion

**Files:**
- Modify: `src/services/clipping/server.ts`
- Modify: `src/routes/_authenticated.app.youtube-clipper.index.tsx`
- Create: `src/routes/_authenticated.app.youtube-clipper.index.test.tsx`

**Interfaces:**
- Produces: `deleteClipJob({ data: { jobId, confirmation: "DELETE" } }) => { ok: true }`.

- [ ] **Step 1: Write failing dashboard tests**

Assert each row has an accessible “Delete <title>” action. Clicking it must not navigate. Confirming calls `deleteClipJob`, shows busy state, invalidates the route, and removes or marks the row. Cancelling makes no server call.

- [ ] **Step 2: Run the test and confirm failure**

Run: `npm test -- --run src/routes/_authenticated.app.youtube-clipper.index.test.tsx`

Expected: FAIL because the delete action does not exist.

- [ ] **Step 3: Implement the server wrapper**

Validate a UUID and literal `DELETE`, require the current session, and call `request_job_deletion`. Convert access and RPC failures through `userFacingError` at the caller.

- [ ] **Step 4: Refactor the job row and add confirmation**

Replace the row-level Link with a non-interactive article containing a dedicated title link and delete button. Use `ConfirmationDialog` copy that explains active work is stopped and private generated/source assets are queued for deletion.

- [ ] **Step 5: Run tests**

Run: `npm test -- --run src/routes/_authenticated.app.youtube-clipper.index.test.tsx src/integration/supabase.integration.test.ts && npm run typecheck`

Expected: route test PASS; Supabase integration remains skipped unless explicitly enabled.

- [ ] **Step 6: Commit**

```powershell
git add src/services/clipping/server.ts src/routes/_authenticated.app.youtube-clipper.index.tsx src/routes/_authenticated.app.youtube-clipper.index.test.tsx
git commit -m "feat: add clipping job deletion"
```

### Task 6: Direct responsive authentication layout

**Files:**
- Modify: `src/components/auth/auth-shell.tsx`
- Modify: `src/components/auth/auth-shell.test.tsx`
- Verify: `src/routes/login.tsx`
- Verify: `src/routes/signup.tsx`
- Verify: `src/routes/forgot-password.tsx`
- Verify: `src/routes/reset-password.tsx`
- Verify: `src/routes/verify-email.tsx`

**Interfaces:**
- Preserves: `AuthShell`, `AuthField`, `AuthForm`, and `GoogleAuthButton` public props.

- [ ] **Step 1: Extend auth-shell tests**

Assert the shell root uses a direct full-height grid and does not contain the old rounded outer-card, border, max-width, overflow-hidden, or heavy-shadow class combination. Keep accessible main content and product-logo labelling.

- [ ] **Step 2: Run test and confirm failure**

Run: `npm test -- --run src/components/auth/auth-shell.test.tsx`

Expected: FAIL against the current card wrapper.

- [ ] **Step 3: Implement the direct layout**

Use `min-h-screen lg:grid-cols-[minmax(22rem,.88fr)_minmax(30rem,1.12fr)]`. The brand panel reaches viewport edges on desktop. The form column uses `bg-surface-page` directly and centres only the form content with `max-w-xl`; it is not itself a floating card. On mobile, show compact brand identification above the form and hide the long brand narrative.

- [ ] **Step 4: Run auth tests and route build**

Run: `npm test -- --run src/components/auth src/routes/login.tsx src/routes/signup.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/components/auth/auth-shell.tsx src/components/auth/auth-shell.test.tsx
git commit -m "refactor: flatten authentication layout"
```

### Task 7: Full verification and production release

**Files:**
- Modify only if tests expose defects in files already covered above.

- [ ] **Step 1: Run repository quality gates**

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm --prefix services/video-worker run typecheck
npm --prefix services/video-worker test
npm --prefix services/video-worker run build
git diff --check
```

Expected: zero errors; only already-documented lint warnings are acceptable.

- [ ] **Step 2: Run production-relevant Playwright coverage**

Verify desktop and mobile auth layout, all SelectField keyboard interactions, Free clip-count locked options, plan-limit recovery, YouTube thumbnail fallback, and job deletion confirmation. Capture screenshots only under `output/playwright/` and remove generated CLI artifacts before committing.

- [ ] **Step 3: Confirm migration state and production environment**

Run: `npx supabase migration list` and `npx vercel env pull .vercel/.env.production.local --environment=production --yes`.

Expected: local/remote migrations align and required public Supabase values parse as non-empty.

- [ ] **Step 4: Push and deploy**

```powershell
git push origin main
npx vercel deploy --prod --yes
```

Expected: normal fast-forward push; Vercel deployment becomes Ready and aliases `https://vidrial.vercel.app`.

- [ ] **Step 5: Verify production**

Check HTTP 200 for `/login`, correct protected-route redirect, zero browser console errors, Render `/healthz` and `/readyz` HTTP 200, tier-aware dropdown behaviour, and no raw plan error codes.

- [ ] **Step 6: Confirm final repository state**

Run: `git status -sb; git rev-parse HEAD; git rev-parse origin/main`.

Expected: clean `main`, identical local and remote hashes.
