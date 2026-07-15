/**
 * Central brand configuration. Rename everywhere by editing this file.
 */
export const brand = {
  name: "Vidrial",
  domain: "vidrial.app",
  descriptor: "AI-assisted video editing",
  tagline: "AI video editing that understands your project",
  headline: "Your footage. One prompt. A finished first cut.",
  promise:
    "Upload raw clips, audio and images. Tell us what you're making. We find the moments, propose the edit and build a timeline you can still control.",
  principles: ["Understand every asset.", "Plan before editing.", "Keep every result editable."],
  supportEmail: "hello@vidrial.app",
  announcement: {
    text: "Private beta — build your first cut with AI, then edit every decision.",
    href: "/roadmap",
    cta: "See the roadmap",
  },
} as const;

export type Brand = typeof brand;
