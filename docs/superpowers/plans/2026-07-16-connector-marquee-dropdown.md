# Connector marquee and dropdown implementation plan

1. Add the supplied motion dependency and a typed, reduced-motion-aware SVG-path marquee primitive under `src/components/ui`.
2. Build a marketing connector marquee from `CONNECTOR_REGISTRY` and `ConnectorIcon`, then replace the homepage `TimelineRibbon` usage.
3. Upgrade the shared Radix dropdown-menu primitive with the supplied pointer/focus behavior and Vidrial styling.
4. Reimplement `SelectField` on the shared dropdown radio group while preserving its public API and form behavior.
5. Add focused tests for the registry-backed marquee and dropdown selection/locked states.
6. Run the complete application and worker verification commands, inspect desktop and mobile production views in Chrome, commit, push `main`, and deploy production.
