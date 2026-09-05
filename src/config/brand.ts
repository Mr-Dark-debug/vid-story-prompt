/**
 * Central brand configuration. Rename everywhere by editing this file.
 */
export const brand = {
  name: "Vidrial",
  domain: "vidrial.app",
  descriptor: "AI-assisted video clipping",
  tagline: "Turn long videos into clips worth watching",
  headline: "One video. Your strongest moments. Ready to share.",
  promise:
    "Bring a video you own or are authorised to use. Find complete moments, add captions and export short clips for your audience.",
  principles: ["Keep the context.", "Explain every selection.", "Review before sharing."],
  supportEmail: "hello@vidrial.app",
  announcement: {
    text: "Private beta — turn long videos into captioned short clips.",
    href: "/roadmap",
    cta: "See the roadmap",
  },
} as const;

export type Brand = typeof brand;
