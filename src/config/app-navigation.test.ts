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

  it("lists AI chat and AI provider settings with breadcrumbs that never expose thread ids", () => {
    expect(appNavItems.map((item) => item.to)).toContain("/app/chat");
    expect(getAppBreadcrumbs("/app/chat")).toEqual([{ label: "AI chat" }]);
    expect(getAppBreadcrumbs("/app/chat/6f1c0a54-0000-4000-8000-000000000001")).toEqual([
      { label: "AI chat", to: "/app/chat" },
      { label: "Conversation" },
    ]);
    expect(getAppBreadcrumbs("/app/settings/ai-providers")).toEqual([
      { label: "Settings", to: "/app/settings" },
      { label: "AI providers" },
    ]);
  });

  it("does not expose project identifiers in breadcrumbs", () => {
    expect(getAppBreadcrumbs("/app/projects/private-project-id/editor")).toEqual([
      { label: "Projects", to: "/app/projects" },
      { label: "Editor" },
    ]);
  });
});
