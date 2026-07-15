import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("connector dependency and client boundaries", () => {
  it("ships no unofficial YouTube downloader or Remotion dependency", async () => {
    const manifests = await Promise.all([
      readFile(join(root, "package.json"), "utf8"),
      readFile(join(root, "services/video-worker/package.json"), "utf8"),
    ]);
    const manifestText = manifests.join("\n").toLowerCase();
    expect(manifestText).not.toMatch(/yt-dlp|youtube-dl|ytdl-core|youtubei|remotion/);
    expect(manifestText).toContain("@fontsource/manrope");
    expect(manifestText).toContain("@fontsource/jetbrains-mono");
  });

  it("keeps encrypted provider token fields out of browser component source", async () => {
    const browserFiles = [
      "src/components/connectors/source-picker.tsx",
      "src/components/youtube-clipper/job-wizard.tsx",
      "src/routes/_authenticated.app.settings.integrations.tsx",
    ];
    const source = (
      await Promise.all(browserFiles.map((file) => readFile(join(root, file), "utf8")))
    ).join("\n");
    expect(source).not.toMatch(/access_token_encrypted|refresh_token_encrypted|client_secret/i);
  });
});
