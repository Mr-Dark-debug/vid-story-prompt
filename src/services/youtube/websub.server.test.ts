import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  channelIdFromTopic,
  deriveWebSubSecret,
  parseYouTubeNotification,
  verifyWebSubSignature,
} from "./websub.server";

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <entry><yt:videoId>dQw4w9WgXcQ</yt:videoId><yt:channelId>UC_x5XG1OV2P6uZZ5FSM9Ttw</yt:channelId>
  <title>Licensed fixture</title><published>2026-07-13T12:00:00Z</published><updated>2026-07-13T12:01:00Z</updated></entry>
</feed>`;

describe("YouTube WebSub", () => {
  it("parses bounded safe Atom notifications", () => {
    expect(parseYouTubeNotification(XML)).toMatchObject({
      videoId: "dQw4w9WgXcQ",
      channelId: "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      title: "Licensed fixture",
    });
  });

  it("rejects entity declarations", () => {
    expect(() =>
      parseYouTubeNotification(`<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>${XML}`),
    ).toThrow("Unsafe XML");
  });

  it("verifies the exact hub signature", () => {
    const secret = deriveWebSubSecret(
      "UC_x5XG1OV2P6uZZ5FSM9Ttw",
      "a-long-master-webhook-secret-for-tests",
    );
    const signature = `sha1=${createHmac("sha1", secret).update(XML).digest("hex")}`;
    expect(verifyWebSubSignature(XML, signature, secret)).toBe(true);
    expect(verifyWebSubSignature(`${XML}x`, signature, secret)).toBe(false);
  });

  it("accepts only the official channel feed topic", () => {
    expect(
      channelIdFromTopic(
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw",
      ),
    ).toBe("UC_x5XG1OV2P6uZZ5FSM9Ttw");
    expect(
      channelIdFromTopic(
        "https://evil.example/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw",
      ),
    ).toBeNull();
  });
});
