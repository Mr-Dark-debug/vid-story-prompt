# Dual-line connector marquee design

## Approved direction

The connector marquee becomes a compact, full-viewport band with two continuous horizontal paths. The upper row moves from left to right while the lower row moves from right to left. Both paths begin and end beyond the viewport so connectors enter and leave naturally instead of turning through a circular loop.

Intersecting CSS masks fade the outer 9% of each side and the outer 7% of the top and bottom so tiles never terminate against a hard clipping boundary. The connector catalog remains registry-driven. Each row distributes two copies of the active connector set for a steady, endless flow without large gaps. Tiles remain compact, draggable, hover-responsive, and accessible, with reduced-motion behavior unchanged. The second visual row is hidden from assistive technology so connector names are announced once.

## Responsive behavior

- The component breaks out of the marketing `Container` with `100dvw` while the rest of the hero stays aligned to the page grid.
- Both SVG paths begin and end outside their view boxes, keeping edge motion continuous.
- The paths use subtle opposing curves rather than a circular turn.
- Tiles are 48px on compact screens and 60px from the small breakpoint upward.
- The mask uses separate horizontal and vertical feathers with a fully opaque centre.

## Verification

The component test must prove that both opposing rows render the registry-derived connector set and retain the full-bleed four-edge mask. Typecheck, lint, app tests, worker tests, and production builds must pass before Git push and Vercel deployment.
