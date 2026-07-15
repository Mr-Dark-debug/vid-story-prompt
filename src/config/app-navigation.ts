export type AppNavItem = {
  label: string;
  to: string;
  description: string;
};

export type AppNavGroup = {
  label: string;
  items: AppNavItem[];
};

export const appNavGroups: AppNavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Overview", to: "/app", description: "Workspace activity and usage" },
      {
        label: "YouTube Clipper",
        to: "/app/youtube-clipper",
        description: "Create and manage clipping jobs",
      },
      { label: "Projects", to: "/app/projects", description: "Browse your video projects" },
      { label: "Templates", to: "/app/templates", description: "Reusable editing templates" },
      { label: "Uploads", to: "/app/uploads", description: "Manage authorised source media" },
    ],
  },
  {
    label: "Manage",
    items: [
      { label: "Usage", to: "/app/usage", description: "Plan usage and limits" },
      { label: "Billing", to: "/app/billing", description: "Plan and billing details" },
      { label: "Settings", to: "/app/settings", description: "Account and workspace settings" },
    ],
  },
  {
    label: "Support",
    items: [
      { label: "Help", to: "/app/help", description: "Guides and product help" },
      { label: "Feedback", to: "/app/feedback", description: "Share product feedback" },
    ],
  },
];

export const appNavItems = appNavGroups.flatMap((group) => group.items);

export const settingsNavItems = [
  { label: "Profile", to: "/app/settings", description: "Name and account identity" },
  {
    label: "Preferences",
    to: "/app/settings/preferences",
    description: "Editing and workspace defaults",
  },
  {
    label: "Notifications",
    to: "/app/settings/notifications",
    description: "Email and product alerts",
  },
  {
    label: "Integrations",
    to: "/app/settings/integrations",
    description: "Connected publishing accounts",
  },
  {
    label: "Privacy & data",
    to: "/app/settings/privacy",
    description: "Data exports and account controls",
  },
] as const;

export const commonActions = [
  {
    id: "new-project",
    label: "Create a new project",
    description: "Start an editable video project",
    to: "/app/projects/new",
    keywords: "create add project",
  },
  {
    id: "new-clipping-job",
    label: "Start a clipping job",
    description: "Create clips from authorised source media",
    to: "/app/youtube-clipper/new",
    keywords: "youtube clip video job",
  },
  {
    id: "upload-media",
    label: "Upload source media",
    description: "Add an authorised media file",
    to: "/app/uploads",
    keywords: "upload add file media",
  },
] as const;

const routeLabels = new Map<string, string>([
  ...appNavItems.map((item) => [item.to, item.label] as const),
  ...settingsNavItems.map((item) => [item.to, item.label] as const),
  ["/app/projects/new", "New project"],
  ["/app/youtube-clipper/new", "New clipping job"],
]);

export type BreadcrumbItem = { label: string; to?: string };

export function getAppBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === "/app") return [{ label: "Overview" }];

  const exact = routeLabels.get(pathname);
  if (pathname.startsWith("/app/settings")) {
    return [
      { label: "Settings", to: pathname === "/app/settings" ? undefined : "/app/settings" },
      ...(pathname === "/app/settings" ? [] : [{ label: exact ?? "Settings" }]),
    ];
  }
  if (pathname.startsWith("/app/projects/")) {
    const suffix = pathname.split("/").at(-1);
    const detailLabel =
      suffix === "editor"
        ? "Editor"
        : suffix === "media"
          ? "Media"
          : suffix === "transcript"
            ? "Transcript"
            : suffix === "exports"
              ? "Exports"
              : suffix === "versions"
                ? "Versions"
                : suffix === "new"
                  ? "New project"
                  : "Project";
    return [{ label: "Projects", to: "/app/projects" }, { label: detailLabel }];
  }
  if (pathname.startsWith("/app/youtube-clipper/")) {
    return [
      { label: "YouTube Clipper", to: "/app/youtube-clipper" },
      { label: exact ?? (pathname.includes("/clips/") ? "Clip editor" : "Clipping job") },
    ];
  }
  return [{ label: exact ?? "Workspace" }];
}
