# Research notes: How to Fix Incorrect AI Captions and Transcription Errors

Checked: 2026-07-31  
Backlog ID: 36  
Primary query: `fix auto captions`

## Intent and page ownership

This is a repair workflow, not a general caption-design article. It owns diagnosis, risk-first text correction, speaker labels, punctuation, timing, and final caption QA. ID 37 owns prevention and terminology preparation; ID 38 owns editorial removal of media.

The original contribution is a layered error diagnosis and a strict separation between correcting displayed text, changing a transcript record, and cutting associated audio/video.

## Evidence reviewed

- W3C WAI says automatic captions require accuracy checking and defines captions as synchronized speech plus meaningful non-speech information.
- YouTube Help documents automatic-caption failure modes and provides current text/timestamp editing instructions.
- Descript and Riverside Help show that transcript correction and media deletion are distinct operations in transcript-led editors.
- YouTube, Descript, and Riverside documentation were inspected as the strongest actionable results for the query. Their interfaces differ, so the article extracts a portable correction workflow rather than paraphrasing one product tutorial.

Community search was used only to identify recurring pain points such as repetitive name corrections and accidental timeline edits. No Reddit anecdote is treated as authoritative.

## Claims and exclusions

The article does not publish an accuracy percentage, promise that a model can identify all speakers, or prescribe a universal characters-per-line rule. It recommends evidence for names and numbers, flags uncertainty rather than inventing words, and delays timing work until structural edits are stable.

## Vidrial truth

Transcript correction is Available. Animated caption presets are Beta. SRT/VTT and filler-word removal are Coming soon. The CTA does not imply that text correction deletes media.

## Review flags

Confirm current terminology of the correction control in Vidrial UI. Recheck YouTube help and all competitor help URLs. Reviewer should test whether internal product link `/youtube-clipper` remains the best contextual destination.
