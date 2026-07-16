# Full-bleed connector marquee design

## Approved direction

The connector path becomes a full-viewport visual that appears to enter from beyond the left edge and leave beyond the right edge. A CSS mask fades the outer 9% of each side so tiles never terminate against a hard clipping boundary.

The looping turn moves from the visual centre to approximately 68% of the viewport width. The connector catalog remains registry-driven, but only one copy is distributed around the path so every logo has materially more breathing room. Tiles remain compact, draggable, hover-responsive, and accessible, with reduced-motion behavior unchanged.

## Responsive behavior

- The component breaks out of the marketing `Container` with `100dvw` while the rest of the hero stays aligned to the page grid.
- The SVG path begins and ends outside its view box, keeping edge motion continuous.
- Tiles are 48px on compact screens and 60px from the small breakpoint upward.
- The mask uses transparent outer stops, a short feather, and a fully opaque centre.

## Verification

The component test must prove a single complete registry-derived connector set is rendered. Typecheck, lint, app tests, worker tests, and production builds must pass before Git push and Vercel deployment.
