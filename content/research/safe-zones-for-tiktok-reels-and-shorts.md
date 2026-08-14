# Research note: Safe Zones for TikTok, Reels and Shorts: Where Captions Should Go

- Backlog ID: 44
- Primary query: `short form safe zones`
- Checked: 2026-07-31
- Dominant intent: Keep captions, faces, logos, and calls to action clear of short-form platform controls.
- Intended reader: A video editor, designer, social producer, or agency building reusable vertical templates.

## Search and result review

Queries reviewed included `TikTok safe zone official`, `TikTok TopView safe zone device language`, `Instagram Reels safe zone official`, `Meta Reels safe zone checker`, and `YouTube Shorts caption safe zone`. Search results contain many incompatible pixel overlays. Official TikTok documentation confirms that safe zones vary by dimensions, caption length, format, language, and device; Meta provides a context-specific checker for Reels ad creative. The draft therefore avoids fabricating universal coordinates.

## Official and primary sources

1. [TikTok for Business: In-feed ad specifications](https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads?lang=en-GB) - current statement that safe zones vary with dimensions, caption length, and additional formats.
2. [TikTok for Business: TopView specifications](https://ads.tiktok.com/help/article/tiktok-reservation-topview?lang=en-GB) - device/language/stage variation and preview-tool guidance.
3. [TikTok for Business: Creative best practices](https://ads.tiktok.com/help/article/creative-best-practices?lang=en) - vertical creative and keeping elements visible in the UI safe zone.
4. [Meta for Business: Reels ads](https://www.facebook.com/business/ads/facebook-instagram-reels-ads) - 9:16 creative, safe-zone emphasis, and Meta's safe-zone checker link.
5. [Instagram Help: Reel aspect ratio and resolution](https://www.facebook.com/help/1038071743007909) - current canvas range and profile-cover context.
6. [YouTube Help: Upload Shorts](https://support.google.com/youtube/answer/12779649?hl=en-GB) - square/vertical Shorts context used for variant checks.

Advertising sources are labeled as advertising documentation and not presented as fixed organic-player coordinates.

## Result weaknesses addressed

- No unattributed pixel measurement is called official.
- Safe-zone variation is explained rather than hidden.
- The article protects faces and product UI as well as captions.
- Caption animation is tested at its largest state.
- Templates are dated and labeled by device/context.

## Vidrial truth checked

`src/domain/features/availability.ts` and `/features` were checked. Caption correction and timeline rearrangement are Available. Animated caption presets are Beta. Custom fonts and subject tracking are Coming soon.

## Original contribution

The draft defines a four-edge collision map, separates three text layers, provides six stress frames for testing, and turns a generic overlay into a traceable, dated platform/device template.
