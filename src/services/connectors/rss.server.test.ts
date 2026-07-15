import { describe, expect, it } from "vitest";
import { parsePodcastXml } from "./rss.server";

describe("podcast RSS parser", () => {
  it("extracts authorised media enclosures without executing XML", () => {
    const result = parsePodcastXml(
      `<?xml version="1.0"?><rss><channel><title>Builder Notes</title><itunes:image href="https://cdn.example.com/show.jpg"/><item><guid>ep-1</guid><title><![CDATA[The durable queue]]></title><description>Retries &amp; leases</description><pubDate>Tue, 14 Jul 2026 10:00:00 GMT</pubDate><itunes:duration>01:02:03</itunes:duration><enclosure url="https://cdn.example.com/ep-1.mp3" type="audio/mpeg" length="1234"/></item></channel></rss>`,
      "https://example.com/feed.xml",
    );
    expect(result.title).toBe("Builder Notes");
    expect(result.episodes[0]).toMatchObject({
      title: "The durable queue",
      durationSeconds: 3723,
      enclosureBytes: 1234,
      enclosureUrl: "https://cdn.example.com/ep-1.mp3",
    });
  });

  it("rejects feeds without public media enclosures", () => {
    expect(() =>
      parsePodcastXml(
        "<rss><channel><title>Empty</title></channel></rss>",
        "https://example.com/feed.xml",
      ),
    ).toThrow(/No public audio or video/);
  });
});
