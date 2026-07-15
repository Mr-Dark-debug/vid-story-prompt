# Vidrial launch film design

## Outcome

Create a production-ready 50-second Remotion launch film at 1920x1080, 30 fps. The film communicates the existing Vidrial promise: authorised footage enters a private project, one clear instruction produces a reviewable edit plan, and the approved plan becomes an editable first cut.

The finished deliverables are the Remotion source, six representative stills, an H.264/AAC master, a lightweight review encode, a film README, asset credits, and a concise fidelity disclosure.

## Creative approach

The film uses one continuous architectural transformation rather than seven unrelated cards. Neutral source fragments align into the real Vidrial workspace; the AI review panel expands into explainable decision rows; those rows fold into the real multi-track timeline; the completed workspace collapses through the split-portal mark for the final lockup.

The visual system is warm white, charcoal, cool neutral, and controlled coral. Movement is economical: masked reveals, panel alignment, restrained scale, deterministic typing, magnetic clip assembly, and a single playhead sweep. There are no gradients associated with generic AI imagery, particles, sparkles, glass effects, or decorative 3D.

## Product fidelity

Faithful structures are derived from the current application:

- the authorised local upload state and private project framing;
- the project editor's split preview/AI-panel layout;
- the AI editor's prompt, review-before-apply language, decision rows, accept/reject controls, and apply action;
- the multi-track video, audio, and caption timeline with ruler, clips, selection, and playhead;
- aspect-ratio choices, caption controls, watermark status, project versions, and completed output states that already exist in the repository.

Abstract representations are limited to:

- the roastery source imagery, waveform shapes, transcript excerpts, and media-card thumbnails;
- the spatial expansion of plan decisions and the magnetic assembly transition;
- the final project overview arrangement used for cinematic clarity.

No customer, testimonial, usage statistic, integration, or unsupported export destination appears. YouTube downloading is not shown or implied. All processing is paired with an explicitly authorised uploaded source.

## Scene design and timing

### 1. Signal / identity — frames 0–89

Warm white opens with a narrow portal cut. The two halves of the production `LogoMark` reveal through masks, then resolve into a charcoal mark and `VIDRIAL` wordmark. A short original tonal impact lands at lockup.

### 2. The starting point — frames 90–239

Media cards, waveform strips, transcript fragments, and timecodes arrive on slightly offset editorial axes. `Footage everywhere.` and `The story still hidden.` reveal in separate beats. The fragments align into one project window by the scene end.

### 3. One clear instruction — frames 240–449

A simplified but faithful editor shell shows an authorised source asset. The exact prompt types frame-by-frame. Submit creates a deliberate coral focus event, followed by labelled progress states: `Transcribing`, `Planning`, and `Preparing edit`.

### 4. Explainable intelligence — frames 450–749

Three reviewable decisions enter in sequence and connect to transcript ranges with fine rules and timecodes. Accept controls and an `Apply accepted` action are visible. The headline `See the reasoning. Keep control.` remains legible while the plan is demonstrated.

### 5. First-cut assembly — frames 750–1049

Four clips snap onto video, audio, and caption tracks. The playhead crosses the timeline while the preview changes once. A selected cut point moves and settles; a restrained 9:16 guide appears briefly. The scene carries `Editable by design.` and `Ready for your judgment.`

### 6. Usable outputs — frames 1050–1289

The project overview shows one authorised source, a completed first cut, 16:9 and 9:16 output cards, captions enabled, and a quiet watermark-entitlement status. The headline reads `From source to shareable cut—in one workspace.`

### 7. Brand close — frames 1290–1499

The workspace collapses into the portal mark on charcoal. Three lines resolve sequentially: `Your footage.`, `One prompt.`, `A finished first cut.` The real wordmark, `vidrial.vercel.app`, and a coral `Create your first cut` CTA hold for at least three seconds while the music resolves with a frame-based tail.

## Architecture

The implementation lives in `src/remotion/` and is registered through a dedicated Remotion entry point. It is not imported by application routes.

Small components own one responsibility each:

- `BrandMark` wraps the production `LogoMark` without copying its geometry.
- `EditorialHeadline`, `ProductWindow`, `DeterministicTyping`, `Cursor`, `StatusChip`, and `CaptionCard` provide reusable film primitives.
- `DecisionRow` and transcript-range components build the explainable-plan scene.
- `TimelineClip`, `Waveform`, and `Playhead` build the edit scene.
- `FinalLockup` owns the closing statement and CTA.
- Seven scene components own local layout and animation timing.
- A Zod schema validates headline copy, destination URL, voiceover/music toggles, and replaceable asset paths.

Animation state is derived only from `useCurrentFrame()`, `useVideoConfig()`, clamped `interpolate()` calls, and sequences. No browser timers, CSS transitions, CSS keyframes, or unseeded randomness are used.

## Typography and assets

No licensed Museum Sans files are present, so the film uses the approved Manrope fallback and JetBrains Mono for timecodes/status metadata. Font files must be sourced through a license-safe package or existing repository dependency and credited. No checkerboard PNG logo reference is used.

The source-preview art is drawn with deterministic CSS/SVG shapes and contains no external photography. Music and interface sounds are synthesized locally from original oscillators/noise envelopes, contain no samples or recognisable melody, and are stored as replaceable public assets. Voiceover remains optional and disabled in the master unless an approved recording is supplied.

## Audio plan

The original bed targets 106 BPM with soft low percussion, a restrained pulse, and sparse granular-like filtered texture. Five original cues mark logo lockup, prompt submit, plan reveal, timeline snap, and CTA resolve. Frame-based gain envelopes create the intro and final tail. The no-voice master keeps full on-screen storytelling; the README includes the supplied narration timing sheet and replacement instructions.

## Failure handling

The default composition renders without optional voiceover or external media. Zod rejects malformed props before rendering. Missing optional asset paths fall back to abstract artwork rather than producing blank frames. Render commands fail visibly on missing required public assets. Verification notes must distinguish completed local rendering from checks blocked by unavailable runtimes or credentials.

## Verification

Verification covers:

- root typecheck, lint, unit tests, and production build;
- worker typecheck, tests, and build;
- Remotion-specific typecheck and composition discovery;
- still renders at frames 60, 330, 600, 900, 1170, and 1410;
- visual inspection of every still for safe areas, clipping, contrast, font loading, logo integrity, and checkerboard artifacts;
- full master and review renders, followed by media probing for duration, frame rate, resolution, codecs, audio presence, and final-frame hold;
- full-film playback inspection for blank frames, flashes, abrupt cuts, timing defects, and audio-tail truncation;
- a credits audit covering every non-code asset.

## Known constraints

- The repository currently contains no licensed Museum Sans files; Manrope is therefore required.
- No approved narration recording is supplied, so the default master is music-and-interface-sound only.
- Product footage is abstract by design; it does not claim a real customer or campaign.
- Provider, Supabase, and worker integration success is not required to render the film and will not be fabricated.
