import { afterEach, describe, expect, it, vi } from "vitest";
import { listGoogleDriveAssets } from "./google-drive/adapter.server";
import { listDropboxAssets } from "./dropbox/adapter.server";
import { listOneDriveAssets } from "./onedrive/adapter.server";

afterEach(() => vi.unstubAllGlobals());

describe("official cloud provider adapters", () => {
  it("filters and maps Google Drive video/audio files", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          nextPageToken: "next",
          files: [
            {
              id: "g1",
              name: "talk.mp4",
              mimeType: "video/mp4",
              size: "100",
              modifiedTime: "2026-01-01T00:00:00Z",
              videoMediaMetadata: { durationMillis: "90000", width: 1920, height: 1080 },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await listGoogleDriveAssets({ accessToken: "secret", query: "talk" });
    expect(result).toMatchObject({
      nextCursor: "next",
      assets: [{ id: "g1", durationSeconds: 90, kind: "video" }],
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("video%2F");
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer secret");
  });

  it("maps Dropbox media and ignores non-media files", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            entries: [
              {
                ".tag": "file",
                id: "d1",
                name: "clip.mov",
                size: 200,
                server_modified: "2026-01-01T00:00:00Z",
              },
              {
                ".tag": "file",
                id: "d2",
                name: "notes.pdf",
                size: 10,
                server_modified: "2026-01-01T00:00:00Z",
              },
            ],
            has_more: false,
          }),
          { status: 200 },
        ),
      ),
    );
    const result = await listDropboxAssets({ accessToken: "secret" });
    expect(result.assets.map((asset) => asset.id)).toEqual(["d1"]);
  });

  it("maps OneDrive media and preserves authorised page cursors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            value: [
              {
                id: "o1",
                name: "episode.m4a",
                size: 300,
                file: { mimeType: "audio/mp4" },
                audio: { duration: 45000 },
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const result = await listOneDriveAssets({ accessToken: "secret" });
    expect(result.assets[0]).toMatchObject({ id: "o1", kind: "audio", durationSeconds: 45 });
    await expect(
      listOneDriveAssets({ accessToken: "secret", cursor: "https://evil.example/page" }),
    ).rejects.toThrow(/Invalid OneDrive page cursor/);
  });
});
