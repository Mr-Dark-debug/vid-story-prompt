# Full-Bleed Connector Marquee Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: execute this small plan inline; repository instructions prohibit unrequested subagent dispatch.

**Goal:** Make the connector marquee fade naturally at both device edges, span the complete viewport, move its loop to the right, and increase the space between logos.

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

- [ ] Update the focused test to expect one complete active connector set.
- [ ] Break the section out to `100dvw` with a centred negative translation.
- [ ] Apply a two-sided 9% CSS mask and an over-wide path canvas.
- [ ] Replace the path with an off-canvas curve whose loop centre is near 68%.
- [ ] Set `repeat={1}` and responsive 48px/60px tiles.
- [ ] Run `npm test -- --run src/components/marketing/connector-path-marquee.test.tsx` and expect PASS.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and worker verification; expect zero errors.
- [ ] Commit, push `main`, and confirm the Git-backed Vercel production deployment is Ready.
