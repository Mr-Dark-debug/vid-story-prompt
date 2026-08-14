# Research note: TikTok vs Reels vs YouTube Shorts: Sizes, Lengths and Formats

- Backlog ID: 43
- Primary query: `tiktok vs reels vs shorts`
- Checked: 2026-07-31
- Dominant intent: Compare current file, dimension, and duration rules for the three major vertical-video platforms.
- Intended reader: A creator, social editor, marketer, or agency building a repeatable export workflow.

## Search and result review

Queries reviewed included `TikTok upload resolution duration official`, `Instagram Reel length official`, `Instagram Reels aspect ratio official`, `YouTube Shorts three minutes official`, and each platform's ad documentation. Many result tables mix organic posts with ads or preserve the obsolete universal 60-second assumption. This draft labels every context and date-checks official sources.

## Official and primary sources

1. [YouTube Help: Understand three-minute Shorts](https://support.google.com/youtube/answer/15424877?hl=en-EN) - classification rules, upload date, and Content ID behavior for Shorts over one minute.
2. [YouTube Help: Get started with Shorts](https://support.google.com/youtube/answer/10059070/get-started-with-youtube-shorts?hl=en-GB) - current duration and creation context.
3. [YouTube Help: Upload Shorts](https://support.google.com/youtube/answer/12779649?hl=en-GB) - square or vertical upload and three-minute limit.
4. [Instagram Help: Reel length](https://www.facebook.com/help/instagram/225190788256708) - up-to-20-minute editing and over-three-minute recommendation caveat.
5. [Instagram Help: Reel aspect ratio and resolution](https://www.facebook.com/help/1038071743007909) - accepted ratio, minimum frame rate, and minimum resolution.
6. [TikTok Help: Creator tools and TikTok Studio](https://support.tiktok.com/en/using-tiktok/creating-videos/creator-tools-on-tiktok?lang=nl) - current browser upload file, resolution, size, and duration limits.
7. [TikTok for Business: In-feed ads](https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads?lang=en-GB) - ad-only orientation, size, and duration rules used to demonstrate why context must be labeled.

## Result weaknesses addressed

- Organic, recommended, boosted, and paid contexts are separate.
- 1080 x 1920 is labeled a production recommendation, not a universal requirement.
- YouTube's active Content ID claim rule for Shorts over one minute is included.
- The article explains why the same master still needs platform-specific packaging.
- No universal safe-zone pixel overlay is fabricated.

## Vidrial truth checked

`src/domain/features/availability.ts` and `/features` were checked. 720p, 1080p, and 4K MP4 export, transcript editing, caption correction, direct publishing, and scheduling are Available. Subject tracking and multi-speaker layouts are Coming soon.

## Original contribution

The comparison labels documentation context at the row level and separates accepted files from a recommended production master. It adds rights, cross-platform compression, variable-frame-rate, and packaging checks that specification tables usually omit.
