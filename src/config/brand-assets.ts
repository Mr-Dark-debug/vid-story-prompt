// Versioned URLs replace browser-cached template icons on the next navigation.
export const browserIconLinks = [
  { rel: "icon", href: "/icons/vidrial-v3.ico", sizes: "16x16 32x32 48x48" },
  { rel: "icon", href: "/icons/vidrial-32-v3.png", type: "image/png", sizes: "32x32" },
  { rel: "icon", href: "/icons/vidrial-v3.svg", type: "image/svg+xml", sizes: "any" },
  { rel: "apple-touch-icon", href: "/icons/vidrial-180-v3.png", sizes: "180x180" },
] as const;
