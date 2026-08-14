# Research note: How to Auto-Reframe Two-Person and Multi-Person Podcasts

- Backlog ID: 26
- Primary keyword: `podcast auto reframe`
- Checked: 2026-07-31
- Dominant intent: understand how automatic vertical reframing works, choose suitable source material and layouts, and repair the cases where tracking follows the wrong person or cuts too often
- Reader: an editor evaluating or using automatic reframing on interviews, roundtables, and remote podcasts

## Search-result pattern

Competitor pages describe speaker tracking and dynamic layouts as automatic. Their support documentation also exposes applicability rules, manual crop windows, scene-level layout overrides, position controls, and warnings about multiple points of interest. Adobe explicitly says complex sequences and fast movement may require keyframe cleanup. Community reports emphasise crosstalk, pauses, inconsistent speaker positions, and excessive layout switches.

## Questions the article must answer

- What signals can an auto-reframe system use?
- What is the difference between diarization, active-speaker detection, tracking, and layout selection?
- Which source configurations are easiest or hardest?
- When should a system crop, cut, split, or preserve the group?
- How should editors review automation efficiently?
- When is manual reframing faster than repairing the result?

## Gaps to beat

- “AI detects the speaker” is treated as one operation instead of a chain of uncertain decisions.
- Audio-only speaker labels are assumed to identify the correct face.
- Layout changes are triggered by every vocal event, including laughter and backchannels.
- Review advice says “check the output” without naming the exact transitions to inspect.
- Vendor capability is silently attributed to Vidrial.

## Non-commodity contribution

Explain a **four-layer reframe stack**: speaker diarization, face/subject localisation, active-speaker association, and editorial layout policy. Audit its transition log rather than watching uniformly: inspect speaker changes, overlaps, long pauses, entrances/exits, props/screens, and crop-boundary movement. Use an exception budget to decide whether to repair or reframe manually.

## Product-truth notes

Vidrial subject tracking and multi-speaker layouts are Coming soon. The article may explain third-party and manual methods but cannot call Vidrial an auto-reframer. Available transcript and candidate tools can help define the clip and speaker turns before a separate framing pass.

## Sources reviewed

### Primary and official

- Adobe Help, [Auto Reframe overview](https://helpx.adobe.com/premiere/desktop/add-video-effects/commonly-used-effects/auto-reframe-overview.html). Reviewed 2026-07-31. Supports action identification and automatic sequence/clip reframing for target aspect ratios.
- Adobe Help, [Add Auto Reframe to sequences](https://helpx.adobe.com/premiere/desktop/add-video-effects/commonly-used-effects/add-auto-reframe-effect-to-a-sequence.html). Reviewed 2026-07-31. Documents motion presets, duplicate sequences, and manual fine-tuning for rapid motion or multiple points of interest.
- Instagram Help Centre, [Reel size and aspect ratios](https://www.facebook.com/help/instagram/1038071743007909?locale=en_GB). Reviewed 2026-07-31. Supports current accepted ratios, minimum frame rate, and minimum resolution.
- YouTube Help, [Upload YouTube Shorts](https://support.google.com/youtube/answer/12779649?hl=en-GB). Reviewed 2026-07-31. Supports square or vertical uploads up to three minutes.

### Strong ranking and competitor material

- OpusClip Help, [Subject Tracking](https://help.opus.pro/docs/article/subject-tracking). Reviewed 2026-07-31. Documents automatic moving-speaker tracking using voice/motion cues and manual subject selection.
- OpusClip Help, [Layout and reframing](https://help.opus.pro/docs/article/layout-and-reframing). Reviewed 2026-07-31. Documents layout applicability, per-segment overrides, and manual reframing.
- Descript Help, [Apply a layout to a scene](https://help.descript.com/hc/en-us/articles/10119612485901-Apply-a-layout-to-a-scene). Reviewed 2026-07-31. Documents scene-level layouts, visual roles, and locked layers.
- Riverside, [Layouts and Smart Scenes](https://riverside.com/video-editor/video-editing-glossary/layouts). Reviewed 2026-07-31. Documents automatic changes around active speakers, screenshares, and multiple participants.

### Research and community evidence

- Columbia/ICASSP paper, [Best of Both Worlds: Multi-task Audio-Visual ASR and Active Speaker Detection](https://arxiv.org/abs/2205.05206). Reviewed 2026-07-31. Defines active-speaker detection as selecting which visible face corresponds to the audio.
- Reddit r/podcasting, [Tested AI clipping tools](https://www.reddit.com/r/podcasting/comments/1u10gdn/ive_tested_a_pile_of_ai_clipping_tools_and_they/). Qualitative evidence that crosstalk, pauses, captions, and vertical framing still need cleanup.
- Reddit r/opusclip, [Prevent video shifting between split layouts](https://www.reddit.com/r/opusclip/comments/1tr8txf/how_do_i_prevent_video_shifting_between_splits/). Qualitative evidence that consistent crop coordinates matter across adjacent segments.
- Reddit r/Descript, [Importing multi-track video and active speaker problems](https://www.reddit.com/r/Descript/comments/1awkxy4/importing_video_from_riverside/). Qualitative evidence that source-track structure affects automatic speaker layout behavior.

## Editorial decisions and review risks

- Do not imply auto reframe understands narrative importance.
- Keep audio diarization, face localisation, active-speaker association, tracking, and layout policy separate.
- Present manual override as normal quality control, not exceptional failure.
- Explicitly state Vidrial subject tracking and multi-speaker layouts are Coming soon.

