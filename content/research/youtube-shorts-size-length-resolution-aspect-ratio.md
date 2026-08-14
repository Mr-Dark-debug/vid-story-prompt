# Research note: YouTube Shorts Size, Length, Resolution and Aspect Ratio Guide 2026

- Backlog ID: 13
- Primary keyword: `youtube shorts dimensions`
- Checked: 2026-07-31
- Dominant intent: a current, trustworthy specification sheet that tells creators what qualifies as an organic YouTube Short and what export settings produce a clean mobile result
- Reader: a creator, editor, or social producer exporting a Short from a phone, desktop editor, or long-form source

## Search-result pattern

The search results agree that 9:16 at 1080 x 1920 pixels is the practical full-screen target. They disagree on almost everything around it. Current pages still repeat a 60-second ceiling, call 9:16 the only accepted ratio, reverse 1080 x 1920 into 1920 x 1080 while describing a vertical file, or present third-party scheduler limits as YouTube limits.

YouTube's organic classification language is broader and simpler: for standard channels, videos uploaded on or after 15 October 2024 are categorised as Shorts when they are no longer than three minutes and have a square or vertical aspect ratio. The official upload page repeats “up to three minutes” and “square or vertical.” It does not make 1080 x 1920 a classification requirement.

Google Ads publishes 1080 x 1920 for vertical Full HD assets and 9:16 as its recommended vertical ratio. That is useful corroboration for a working export preset, but it is advertising guidance. The article must label it as a quality and composition recommendation, not substitute it for YouTube's organic Shorts rule.

## Questions the article must answer

- What dimensions should a YouTube Short use in 2026?
- Is 1080 x 1920 required, or simply recommended?
- Which aspect ratios qualify as Shorts?
- How long can an organic Short be now?
- Does the old 60-second limit still apply?
- Which width-height order describes portrait video?
- What codec, container, audio, frame-rate, and bitrate choices are sensible?
- Should an editor add black bars around landscape footage?
- Why can correctly sized video still have edge or interface overlap on some phones?
- What should a creator inspect before uploading?

## Gaps to beat

- Most guides mix **classification requirements** with **export recommendations**.
- Several ranking pages still carry the pre-October-2024 60-second rule.
- Some pages invert width and height, writing 1920 x 1080 for a vertical Short.
- Exact third-party scheduler restrictions are sometimes passed off as native YouTube restrictions.
- “9:16 fills the screen” is treated as a guarantee that every edge will remain visible, despite varying devices and interface overlays.
- Guides often tell editors to add padding even though YouTube says vertical uploads should not contain black bars and its player adapts to the video's shape.
- The extra copyright constraint for Shorts longer than one minute is often omitted.

## Non-commodity contribution

Use a **two-layer specification**:

1. **Platform classification:** square or vertical, up to three minutes, with the applicable upload-date rule.
2. **Practical export preset:** 9:16, 1080 x 1920 pixels, MP4 with H.264 video, AAC-LC audio at 48 kHz, progressive scan, and the same frame rate as the source.

This distinction lets a reader answer two different questions without confusing them: “Will YouTube categorise this as a Short?” and “Will this look like a conventional full-screen Short?” The article also includes a stale-claim correction table and a diagnosis sequence based on the rendered file's real frame—not its filename, editor preview, or `#Shorts` label.

## Product-truth notes

The contextual Vidrial link can state that the YouTube Clipper works with authorised sources to find complete moments, correct captions, and prepare editable clips. Do not promise automatic subject tracking, multi-speaker layouts, B-roll, SRT/VTT export, or any other unavailable feature. Keep the product mention secondary to the specification guide.

## Source-to-claim notes

### Primary and official

- YouTube Help, [Understand three-minute YouTube Shorts](https://support.google.com/youtube/answer/15424877?hl=en-GB). Reviewed 2026-07-31. Supports the standard-channel classification rule for uploads on or after 15 October 2024, the later Official Artist Channel date, and the global block for Shorts over one minute with an active Content ID claim.
- YouTube Help, [Upload YouTube Shorts](https://support.google.com/youtube/answer/12779649?hl=en-GB). Reviewed 2026-07-31. Supports the native desktop upload rule: up to three minutes, square or vertical. Also warns creators to have approval for copyrighted material.
- YouTube Help, [YouTube recommended upload encoding settings](https://support.google.com/youtube/answer/1722171). Reviewed 2026-07-31. Supports MP4, H.264, progressive scan, AAC-LC or Opus, 48 kHz audio, matching the recorded frame rate, and YouTube's current 1080p bitrate guidance.
- YouTube Help, [Upload YouTube videos](https://support.google.com/youtube/answer/57407?hl=en). Reviewed 2026-07-31. Supports letting YouTube adapt vertical, square, or horizontal playback and advises against adding black bars to vertical video.
- YouTube Help, [Supported YouTube file formats](https://support.google.com/youtube/troubleshooter/2888402?hl=en-gb). Reviewed 2026-07-31. Supports YouTube's broad accepted-format list; the article recommends MP4/H.264 for predictable delivery rather than claiming it is the only accepted format.
- Google Ads Help, [About Video views](https://support.google.com/google-ads/answer/13982458?hl=en). Reviewed 2026-07-31. Supports 1080 x 1920 pixels and 9:16 as Google's recommended vertical Full HD ad asset. The article clearly labels this as export guidance, not the organic Shorts classification rule.

### Ranking and competitor material

- vidIQ, [YouTube Shorts Size & Dimensions: The Complete 2026 Guide](https://vidiq.com/blog/post/youtube-shorts-vertical-video/). Reviewed 2026-07-31. Strong query match and a useful 1080-width-by-1920-height explanation, but the same page later repeats a stale 60-second qualification rule and reverses the dimensions in one sentence. This inconsistency is a central gap.
- Hootsuite, [YouTube Shorts: Everything you need to know](https://blog.hootsuite.com/youtube-shorts/). Reviewed 2026-07-31. Correctly covers the three-minute change, but its spec block calls vertical the only orientation, lists 1920 x 1080 as vertical, and gives a 2 GB limit that is not the native organic rule in YouTube's upload help.
- Kapwing, [Social Media Video Aspect Ratios and Sizes — The 2026 Guide](https://www.kapwing.com/resources/social-media-video-aspect-ratios-and-sizes-the-2025-guide/). Reviewed 2026-07-31. Useful multi-platform context, but its Shorts block says landscape is allowed, gives a 15-second minimum, and lists a 10 MB limit. Those claims are not used because the current official organic Shorts pages do not support them.
- Buffer Help, [Using YouTube Shorts with Buffer](https://support.buffer.com/article/562-using-youtube-shorts-with-buffer). Reviewed 2026-07-31. Current scheduler documentation correctly reflects three minutes and 1:1 or 9:16 for Buffer uploads, but Buffer's file-size and accepted-format rules describe its publishing path, not every native YouTube upload.
- Buffer, [How to Get Started with YouTube Shorts](https://buffer.com/resources/what-is-youtube-shorts/). Reviewed 2026-07-31. A strong older result that still describes the former under-60-second classification rule. It demonstrates why date-stamped primary documentation must override older tutorials.

### Community evidence

- Reddit r/youtubers, [1080 x 1920 video appears zoomed or clipped on some phones](https://www.reddit.com/r/youtubers/comments/10m0r3x/it_says_the_recommended_aspect_ratio_for_youtube/). Reviewed 2026-07-31. Qualitative evidence that creators can lose edge content across device shapes; used to motivate an inner safety margin, not as authority for a universal crop amount.
- Reddit r/NewTubers, [Desktop upload appears with black bars or as the wrong shape](https://www.reddit.com/r/NewTubers/comments/1rwvifg/why_do_my_youtube_shorts_have_black_bars_on_pc/). Reviewed 2026-07-31. Qualitative evidence that creators inspect the editor canvas rather than the rendered file and confuse embedded bars with player-added space.
- Reddit r/NewTubers, [How to post Shorts from desktop](https://www.reddit.com/r/NewTubers/comments/1u7s47e/how_to_post_shorts_from_my_desktop/). Reviewed 2026-07-31. Qualitative evidence of confusion between a portrait clip placed inside a 16:9 file and a true portrait export. Community answers are not used as the platform rule.

## Editorial decisions and review risks

- Write dimensions as **width x height** every time: 1080 x 1920 is portrait; 1920 x 1080 is landscape.
- Say that 9:16 and 1080 x 1920 are recommended, not required for organic classification.
- Do not invent a universal pixel-safe-zone measurement. Device shapes and UI placement vary; recommend previewing on more than one device and keeping essential text away from edges and controls.
- Do not claim that `#Shorts`, a filename, or the upload surface controls classification.
- Do not quote third-party uploader limits as YouTube's native limits.
- Recheck three-minute eligibility, the Official Artist Channel date, Content ID behavior, and encoding recommendations before publication.
