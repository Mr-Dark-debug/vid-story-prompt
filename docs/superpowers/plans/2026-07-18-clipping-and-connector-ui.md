# Clipping and Connector UI Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flatten and align the clipping wizard, render every integration once through reusable dialogs, and straighten the full-width dual marquee.

**Architecture:** Keep connector identity/capabilities in the registry and move provider-specific settings into dialog content selected by connector ID. Use existing Radix-based Vidrial dialog/select primitives, a controlled dirty-state guard, and pure horizontal SVG paths for the marketing marquee.

**Tech Stack:** React 19, TanStack Router, Radix UI, Tailwind semantic tokens, Motion, Vitest Testing Library.

## Global Constraints

- `src/domain/connectors/registry.ts` is the connector catalog source of truth.
- Coming-soon connectors never simulate OAuth, imports, or success.
- Import, automation, and publishing remain separate permissions.
- Vidrial semantic tokens and Manrope fallback remain unchanged.
- Dialogs are keyboard accessible and dirty changes require Save, Discard, or Continue editing.

---

### Task 1: Flatten and align the clipping wizard

**Files:**
- Modify: `src/components/youtube-clipper/job-wizard.tsx`
- Modify: `src/components/youtube-clipper/job-wizard.test.tsx`

**Interfaces:**
- Preserves: existing `JobWizard` props, entitlement-aware clip options, source metadata, rights attestation, and submission contract

- [ ] **Step 1: Add failing layout assertions**

Render the YouTube source step and assert only one element has `data-testid="wizard-step-surface"`, the source controls use `data-testid="youtube-source-fields"` without a raised panel class, and preferences use `data-testid="preferences-grid"` with equal row wrappers.

- [ ] **Step 2: Run the focused wizard tests**

Run: `npm test -- src/components/youtube-clipper/job-wizard.test.tsx`
Expected: FAIL because the test IDs/layout contract do not exist.

- [ ] **Step 3: Flatten the source controls**

Remove the provider-card border/background/padding from `ConnectorSourceStep`. Keep metadata as a restrained result panel, preserve rights confirmation, and add the explicit test IDs.

- [ ] **Step 4: Align preferences and review**

Use `grid gap-5 md:grid-cols-2` with each paired field in `grid min-h-full grid-rows-[auto_3.5rem_auto]`. On review, use consistent `grid-cols-[minmax(9rem,0.35fr)_1fr]` rows that collapse to one column below the medium breakpoint.

- [ ] **Step 5: Run focused tests and responsive typecheck**

Run: `npm test -- src/components/youtube-clipper/job-wizard.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/youtube-clipper/job-wizard.tsx src/components/youtube-clipper/job-wizard.test.tsx
git commit -m "fix: align clipping wizard surfaces"
```

### Task 2: Reusable connector settings dialog

**Files:**
- Create: `src/components/connectors/connector-settings-dialog.tsx`
- Create: `src/components/connectors/connector-settings-dialog.test.tsx`
- Modify: `src/routes/_authenticated.app.settings.integrations.tsx`

**Interfaces:**
- Produces: `ConnectorSettingsDialog({ connector, open, onOpenChange, children, isDirty, onSave, saving })`
- Consumes: connector registry entries and live provider state

- [ ] **Step 1: Write failing dialog state tests**

```tsx
render(<ConnectorSettingsDialog open connector={connector} isDirty onSave={save} onOpenChange={setOpen}>…</ConnectorSettingsDialog>);
await user.click(screen.getByRole("button", { name: "Close" }));
expect(screen.getByRole("alertdialog", { name: "Save connector changes?" })).toBeInTheDocument();
```

Assert Continue editing retains the dialog, Discard closes without save, Save awaits `onSave` and then closes, and invalid/saving state disables Save.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- src/components/connectors/connector-settings-dialog.test.tsx`
Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the controlled dialog and dirty guard**

Use `Dialog` for connector settings and `AlertDialog` for the nested unsaved-change decision. Do not call `window.confirm`. Preserve focus and return it to the selected connector tile.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/components/connectors/connector-settings-dialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/connectors/connector-settings-dialog.tsx src/components/connectors/connector-settings-dialog.test.tsx
git commit -m "feat: add connector settings dialog"
```

### Task 3: Registry-only integrations page

**Files:**
- Modify: `src/routes/_authenticated.app.settings.integrations.tsx`
- Create: `src/routes/integrations-page.test.tsx`

**Interfaces:**
- Consumes: `connectorRegistry`, `ConnectorSettingsDialog`, YouTube connection/automation services
- Produces: one connector tile and one dialog entry point per registry item

- [ ] **Step 1: Write duplicate-removal tests**

Render the page loader data and assert YouTube, TikTok, and Instagram each have one connector trigger. Open YouTube and assert connection/automation settings are inside the dialog. Open a coming-soon provider and assert there is no Connect action.

- [ ] **Step 2: Run focused tests**

Run: `npm test -- src/routes/integrations-page.test.tsx`
Expected: FAIL because the standalone sections duplicate providers.

- [ ] **Step 3: Remove duplicate provider blocks**

Delete the standalone YouTube panel and `UpcomingIntegration` calls. Keep one registry grouping and route clicks through selected connector state.

- [ ] **Step 4: Move YouTube settings into dialog content**

Retain current live channel, capability, connect/reconnect/disconnect, rights attestation, and automation form behavior. Track a saved automation snapshot and compare it to the current draft for `isDirty`.

- [ ] **Step 5: Run focused integration UI tests**

Run: `npm test -- src/routes/integrations-page.test.tsx src/components/connectors/connector-settings-dialog.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/_authenticated.app.settings.integrations.tsx src/routes/integrations-page.test.tsx
git commit -m "fix: consolidate connector integration settings"
```

### Task 4: Straight opposing marquee rows

**Files:**
- Modify: `src/components/marketing/connector-path-marquee.tsx`
- Modify: `src/components/marketing/connector-path-marquee.test.tsx`

**Interfaces:**
- Preserves: registry-driven connectors, opposite directions, full-viewport breakout, four-edge mask, reduced-motion behavior

- [ ] **Step 1: Write failing straight-path assertions**

```ts
const paths = container.querySelectorAll('[data-marquee-path]');
expect(paths).toHaveLength(2);
expect([...paths].map((node) => node.getAttribute("data-marquee-path"))).toEqual([
  "M-120 56H1320",
  "M-120 56H1320",
]);
expect([...paths].every((node) => !/[CQ]/.test(node.getAttribute("data-marquee-path") ?? ""))).toBe(true);
```

- [ ] **Step 2: Run focused marquee tests**

Run: `npm test -- src/components/marketing/connector-path-marquee.test.tsx`
Expected: FAIL because both paths are curves.

- [ ] **Step 3: Replace curves with straight paths**

```ts
const horizontalPath = "M-120 56H1320";
```

Pass the same horizontal path to both rows, retain `normal` and `reverse` directions, spacing, repeated registry set, full-bleed width, and intersecting side/vertical fades.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/components/marketing/connector-path-marquee.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/marketing/connector-path-marquee.tsx src/components/marketing/connector-path-marquee.test.tsx
git commit -m "fix: straighten connector marquee tracks"
```

### Task 5: Full verification and release

**Files:**
- Modify only files required by verification failures attributable to this work

**Interfaces:**
- Produces: buildable application and worker plus production verification record

- [ ] **Step 1: Run application checks**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all commands exit 0.

- [ ] **Step 2: Run worker checks**

Run: `npm --prefix services/video-worker run typecheck && npm --prefix services/video-worker test && npm --prefix services/video-worker run build`
Expected: all commands exit 0.

- [ ] **Step 3: Run relevant Supabase integration and browser checks**

Run the configured opt-in integration test, then verify mobile auth rendering, job status/progress/events, wizard steps, integrations dialogs, and marquee at desktop/mobile widths. Do not solve a CAPTCHA automatically.

- [ ] **Step 4: Push and deploy normally**

```bash
git push origin main
npx vercel deploy --prod
```

Apply the new Supabase migration and configure the explicit hostname allowlist. Allow the connected Render deployment to update the worker, then run the controlled end-to-end YouTube clipping job.

- [ ] **Step 5: Report verified outcomes**

Report each check and deployment separately. If Docker, Cloudflare dashboard access, a provider token, Render deployment, or the live YouTube extractor remains unavailable, name that exact missing verification without claiming success.

