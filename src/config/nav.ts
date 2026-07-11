export type NavItem = { label: string; to: string; description?: string };

export const productMenu: NavItem[] = [
  { label: "YouTube Clipper", to: "/youtube-clipper", description: "Turn long videos into editable short clips." },
  { label: "Features", to: "/features", description: "The complete workflow" },
  { label: "How it works", to: "/how-it-works", description: "From footage to first cut" },
  { label: "AI transparency", to: "/ai-transparency", description: "What the AI sees and does" },
  { label: "Security & privacy", to: "/security", description: "Private by default" },
];

export const useCasesMenu: NavItem[] = [
  { label: "YouTube videos", to: "/use-cases/youtube" },
  { label: "Video podcasts", to: "/use-cases/podcasts" },
  { label: "Short-form clips", to: "/use-cases/short-form" },
  { label: "Online courses", to: "/use-cases/courses" },
  { label: "Product demos", to: "/use-cases/product-demos" },
];

export const resourcesMenu: NavItem[] = [
  { label: "Documentation", to: "/docs" },
  { label: "Changelog", to: "/changelog" },
  { label: "Roadmap", to: "/roadmap" },
  { label: "Status", to: "/status" },
  { label: "Contact", to: "/contact" },
];

export const footerColumns: { title: string; items: NavItem[] }[] = [
  {
    title: "Product",
    items: [
      { label: "Features", to: "/features" },
      { label: "How it works", to: "/how-it-works" },
      { label: "Pricing", to: "/pricing" },
      { label: "Roadmap", to: "/roadmap" },
      { label: "Changelog", to: "/changelog" },
    ],
  },
  {
    title: "Use cases",
    items: useCasesMenu,
  },
  {
    title: "Resources",
    items: [
      { label: "Documentation", to: "/docs" },
      { label: "AI transparency", to: "/ai-transparency" },
      { label: "Security", to: "/security" },
      { label: "Status", to: "/status" },
      { label: "Contact", to: "/contact" },
    ],
  },
  {
    title: "Legal",
    items: [
      { label: "Terms", to: "/terms" },
      { label: "Privacy", to: "/privacy" },
      { label: "Cookies", to: "/cookies" },
      { label: "Acceptable use", to: "/acceptable-use" },
      { label: "Copyright", to: "/copyright" },
      { label: "Imprint", to: "/imprint" },
    ],
  },
];

export const appNav: NavItem[] = [
  { label: "Overview", to: "/app" },
  { label: "YouTube Clipper", to: "/app/youtube-clipper" },
  { label: "Projects", to: "/app/projects" },
  { label: "Templates", to: "/app/templates" },
  { label: "Uploads", to: "/app/uploads" },
  { label: "Usage", to: "/app/usage" },
  { label: "Billing", to: "/app/billing" },
  { label: "Settings", to: "/app/settings" },
  { label: "Help", to: "/app/help" },
];
