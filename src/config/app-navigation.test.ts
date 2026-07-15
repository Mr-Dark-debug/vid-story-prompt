import { describe, expect, it } from "vitest";
import { getAppBreadcrumbs } from "./app-navigation";

describe("getAppBreadcrumbs", () => {
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
