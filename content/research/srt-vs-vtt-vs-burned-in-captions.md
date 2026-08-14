# Research note: SRT vs VTT vs Burned-In Captions: Complete Comparison

- Backlog ID: 35
- Primary keyword: `srt vs vtt`
- Checked: 2026-07-31
- Dominant intent: choose a caption delivery format based on player support, styling, editability, accessibility, portability, and visual consistency
- Reader: a creator or developer deciding whether to deliver an SRT, WebVTT track, captions rendered into the video, or more than one output

## Search-result pattern

Comparison pages often reduce the choice to file extensions. SRT is a simple numbered cue format with wide practical support but no single formal standard. WebVTT is a W3C web timed-text format with cue settings, regions, and CSS integration. Burned-in captions are pixels: visually consistent, always visible, and impossible to turn off or correct without re-export. Platform support remains the deciding constraint.

## Non-commodity contribution

Use a **delivery matrix** instead of a winner: editable platform track, standards-based web track, social master, archival source, and correction path. Maintain one verified timed transcript, then derive each delivery output.

## Product-truth notes

Vidrial MP4 export and caption correction are Available. Animated presets are Beta. SRT and VTT export are Coming soon. Do not imply Vidrial can currently produce either sidecar format.

## Sources reviewed

- W3C, [WebVTT specification](https://www.w3.org/TR/webvtt1/). Reviewed 2026-07-31. Primary definition of cues, timings, regions, settings, and CSS cue styling.
- MDN, [WebVTT format](https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API/Web_Video_Text_Tracks_Format). Reviewed 2026-07-31. Strong web-platform implementation reference.
- YouTube Help, [Supported subtitle files](https://support.google.com/youtube/answer/2734698?hl=en). Reviewed 2026-07-31. Supports basic SRT and WebVTT upload while qualifying implementation support.
- Library of Congress, [SubRip subtitle format](https://www.loc.gov/preservation/digital/formats/fdd/fdd000569.shtml). Reviewed 2026-07-31. Primary preservation reference for SRT structure, adoption, and lack of a formal specification.
- W3C WAI, [Captions and subtitles](https://www.w3.org/WAI/media/av/captions/). Reviewed 2026-07-31. Supports closed/open distinction and synchronized meaningful audio.
- YouTube Help, [Edit or remove captions](https://support.google.com/youtube/answer/2734705). Reviewed 2026-07-31. Supports post-upload track editing and downloading.
- Netflix, [Subtitle timing guidelines](https://partnerhelp.netflixstudios.com/hc/en-us/articles/360051554394-Timed-Text-Style-Guide-Subtitle-Timing-Guidelines). Reviewed 2026-07-31. Strong delivery workflow reference, not treated as universal.
- CapCut, [Types of captions](https://www.capcut.com/resource/types-of-captions). Reviewed 2026-07-31. Ranking comparison of open/burned and other caption presentations.
- Reddit r/VIDEOENGINEERING, [CEA 608/708 and SRT limitations](https://www.reddit.com/r/VIDEOENGINEERING/comments/15rrtc4/cea_608708_captioning/). Qualitative practitioner evidence that delivery requirements exceed basic SRT timing/text.

## Review risks

- Do not call SRT a W3C standard.
- Do not promise that WebVTT styling survives every platform upload; players decide support.
- Do not call burned-in captions a substitute for a viewer-controllable track in every context.
- Explicitly state Vidrial SRT/VTT export is Coming soon.

