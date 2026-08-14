# Research note: Burned-In Captions vs Platform Auto-Captions: Which Is Better?

- Backlog ID: 32
- Primary query: `burned in vs auto captions`
- Checked: 2026-07-31
- Dominant intent: Decide which caption method to use for accessibility, social visibility, styling, editing, and multi-platform distribution.
- Intended reader: A creator, editor, accessibility lead, marketer, or video team choosing a caption master and social variants.

## Search review

Queries included `burned in vs auto captions`, `open versus closed captions`, `hardcoded subtitles vs caption file`, official YouTube/Vimeo/Facebook caption workflows, and community accessibility discussions.

Many results compare burned text only with an unreviewed platform transcript. That creates a false choice. The draft distinguishes three options: burned/open captions, corrected selectable captions, and unreviewed platform automatic captions. It recommends a clean master plus a corrected timed-text source, then a separate burned social variant when needed.

## Official and primary sources

1. [W3C WAI: Video Captions](https://www.w3.org/WAI/perspective-videos/captions/) — access benefits, search/indexing benefits, and automatic-caption correction.
2. [YouTube: Automatic captioning](https://support.google.com/youtube/answer/6373554?hl=en-GB) — machine output caveats and review requirement.
3. [YouTube: Supported caption files](https://support.google.com/youtube/answer/2734698?hl=en) — current SRT/VTT and styling behavior.
4. [YouTube: Edit or remove captions](https://support.google.com/youtube/answer/2734705?hl=en) — correcting platform tracks without re-rendering video.
5. [Vimeo OTT: Add subtitles and captions](https://help.vimeo.com/hc/en-us/articles/12426982835857-Add-subtitles-and-captions-to-videos-on-Vimeo-OTT) — soft-text definition, caption/subtitle distinction, language tracks, and viewer appearance controls.
6. [Vimeo: Add captions or subtitles](https://help.vimeo.com/hc/en-us/articles/21956884955537-How-to-add-captions-or-subtitles-to-my-video/) — SRT/WebVTT and track management.
7. [Facebook: Add or remove captions](https://www.facebook.com/help/www/261764017354370) — separate SRT upload and language variants.
8. The FCC Captioning Quality Order was manually verified in a browser for its accurate, synchronous, complete, and properly placed categories. Its document server returned HTTP 406 to the automated link checker, so the draft relies on the accessible W3C source above for its published accessibility guidance.

## Strong result material

1. [University of Maryland Digital Accessibility: Captions](https://www.umaryland.edu/accessibility/creating-accessible-content/social/captions/) — practical burned versus caption-file guidance.
2. [UCL captioning handout](https://www.ucl.ac.uk/teaching-learning/sites/teaching_learning/files/subtitle_handout_v1.3_0.pdf) — open and closed caption distinction.
3. [Captions.ai auto-caption guide](https://captions.ai/blog/how-to-add-auto-captions-to-videos-tips-tools) — current creator workflow; vendor claims were not treated as neutral evidence.

## Community signals

- [r/accessibility discussion](https://www.reddit.com/r/accessibility/comments/1sk76ky/should_video_captions_be_burned_in_the_video/) emphasizes viewer control and when open captions may be appropriate.
- [r/youtube duplicate captions discussion](https://www.reddit.com/r/youtube/comments/1rtk5kz/custom_captions_vs_editing_subtitles_in_burned_in/) identifies overlapping burned and automatic captions as a practical failure.
- [r/premiere OCR recovery](https://www.reddit.com/r/premiere/comments/1jda00m/how_do_i_get_premiere_pro_to_read_subtitles/) illustrates that recovering burned text later may require OCR and retiming.

These comments are qualitative workflow evidence, not accessibility standards.

## Vidrial truth checked

Checked `src/domain/features/availability.ts`, `/features`, and `PRODUCT_SPEC.md`. Caption text/timing correction is Available. Animated caption presets and brand colours are Beta. SRT/VTT export is Coming soon. The article explicitly states that limitation.

## Original contribution

The comparison introduces a three-way model rather than a false binary and gives a two-master workflow: one clean MP4 plus corrected timed text, with an optional burned social render derived from the same approved transcript. It also includes a concrete duplicate-caption test and asset naming scheme.
