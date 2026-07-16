# Dual-Line Connector Marquee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: execute this small plan inline; repository instructions prohibit unrequested subagent dispatch.

**Goal:** Replace the circular connector path with two compact, full-width, endlessly opposing marquee rows while retaining natural four-edge fades.

**Architecture:** Keep motion and path interpolation in the existing marquee primitive. Limit the change to the marketing composition and its focused registry test so other consumers retain their current behavior.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Motion, Vitest.

## Global Constraints

- `CONNECTOR_REGISTRY` remains the only connector catalog.
- Use existing `ConnectorIcon` assets and semantic design tokens.
- Preserve reduced-motion behavior and drag interaction.
- Do not modify generated router files.

---

### Task 1: Full-bleed connector composition

**Files:**

- Modify: `src/components/marketing/connector-path-marquee.tsx`
- Test: `src/components/marketing/connector-path-marquee.test.tsx`

**Interfaces:**

- Consumes: `CONNECTOR_REGISTRY`, `ConnectorIcon`, and `MarqueeAlongSvgPath`.
- Produces: the unchanged `ConnectorPathMarquee` component API.

- [ ] Update the focused test to cover both connector rows and their opposing directions.
- [ ] Break the section out to `100dvw` with a centred negative translation.
- [ ] Intersect a two-sided 9% mask with a 7% top/bottom mask.
- [ ] Replace the circular path with two shallow, off-canvas horizontal curves.
- [ ] Move the upper row forward and the lower row in reverse, with `repeat={2}` on each for an endless, evenly spaced flow.
- [ ] Keep the second visual row out of the accessibility tree so connector labels are announced once.
- [ ] Run `npm test -- --run src/components/marketing/connector-path-marquee.test.tsx` and expect PASS.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and worker verification; expect zero errors.
- [ ] Commit, push `main`, and confirm the Git-backed Vercel production deployment is Ready.
