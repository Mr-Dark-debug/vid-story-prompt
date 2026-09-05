import { describe, expect, it } from "vitest";
import { appNavItems, commonActions, getAppBreadcrumbs } from "./app-navigation";

describe("getAppBreadcrumbs", () => {
  it("keeps active navigation and quick actions clipping-only", () => {
    // Legacy project data remains, but the standalone editor is no longer a product surface.
    const destinations = [...appNavItems, ...commonActions].map((item) => item.to);
    expect(destinations).not.toContain("/app/projects");
    expect(destinations).not.toContain("/app/projects/new");
    expect(destinations).not.toContain("/app/templates");
    expect(commonActions[0].to).toBe("/app/youtube-clipper/new");
  });
  it("builds nested settings breadcrumbs", () => {
    expect(getAppBreadcrumbs("/app/settings/notifications")).toEqual([
      { label: "Settings", to: "/app/settings" },
      { label: "Notifications" },
    ]);
  });

  it("does not expose project identifiers in breadcrumbs", () => {
    expect(getAppBreadcrumbs("/app/projects/private-project-id/editor")).toEqual([
      { label: "Projects", to: "/app/projects" },
      { label: "Editor" },
    ]);
  });
});
