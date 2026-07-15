# Codex production prompt: Vidrial SaaS launch film

Use the following prompt in a fresh Codex task opened at the root of the Vidrial repository.

---

You are working in the existing Vidrial repository. Create a polished, production-ready SaaS product film with Remotion. Do not stop at a storyboard or static mockup: implement the composition, render representative stills, render the final video, inspect the output, fix visual or timing defects, and document the result.

## Non-negotiable preparation

1. Read `AGENTS.md` and follow it exactly.
2. Read `docs/BRANDIDENTITY.md` completely before designing anything.
3. Inspect the real product UI, brand tokens, logo component, available fonts, and current routes. Prefer the existing SVG/logo geometry from `src/components/primitives/logo.tsx`; do not use PNG assets that contain a baked checkerboard or uncertain background.
4. Use the installed `remotion-best-practices`, `remotion-create`, `remotion-markup`, and `remotion-render` skills. Read each selected `SKILL.md` completely before implementation.
5. Check the current Remotion package versions and official APIs before coding. Use frame-driven Remotion animation, not CSS transitions, CSS keyframes, browser timers, or nondeterministic effects.
6. Do not invent customer logos, testimonials, usage numbers, integrations, or product capabilities. If a product screen is not implemented, represent the idea abstractly instead of fabricating a working screen.
7. Do not scrape YouTube media or imply that Vidrial downloads arbitrary YouTube videos. A YouTube URL may be shown as metadata/reference input; processing must be represented as using authorised uploaded media, an owner-controlled HTTPS media source, or a connected storage import.

## Creative direction

Make a 50-second, 1920x1080, 30 fps launch film that feels calm, precise, editorial, and architectural. It must look like a premium creative-tool announcement—not a generic AI template.

Brand system:

- Primary charcoal: `#1D1D1B`
- Medium neutral: `#787C7F`
- Cool neutral: `#B5BCC4`
- Coral accent: `#EF8668`, used sparingly for focus, progress, selected states, and the final call to action
- Base surfaces: warm white and restrained cool-gray panels
- Typography: use a locally licensed Museum Sans font if the repository contains it; otherwise use Manrope. Use JetBrains Mono only for timecodes, status labels, and technical metadata.
- Logo: use the real Vidrial mark and wordmark rules from `docs/BRANDIDENTITY.md`.
- Avoid purple AI gradients, neon glows, particles, sparkles, excessive glassmorphism, cartoon bounce, and gratuitous 3D.

Motion language:

- Movement should be confident and economical: masked reveals, editorial wipes, controlled scale changes, timeline playhead motion, panel stacking, and precise typographic choreography.
- Use `useCurrentFrame()`, `useVideoConfig()`, `interpolate()`, `spring()` only where a subtle physical settle is useful, and `Sequence` or `TransitionSeries` for timing.
- Clamp interpolations. Keep entrances readable and exits clean. Do not animate every element at once.
- Build one visual idea per beat. Use coral to guide the eye, not decorate the frame.
- Respect title-safe and action-safe margins. Nothing essential may touch the frame edge.

## Narrative and exact timing

The core promise is: **“Your footage. One prompt. A finished first cut.”**

### Scene 1 — Signal / identity, 0:00–0:03

- Begin on warm white with near-silent room tone.
- Reveal the Vidrial logo through a precise portal/cut motif derived from the actual mark.
- A short, original audio logo lands with the final wordmark lockup.
- On-screen copy: `VIDRIAL` only. Do not add a slogan yet.

### Scene 2 — The messy starting point, 0:03–0:08

- Editorially arrange several neutral media cards, transcript fragments, waveform strips, and timecode labels into a slightly scattered workspace.
- The composition must remain elegant, not chaotic.
- On-screen copy appears in two beats:
  - `Footage everywhere.`
  - `The story still hidden.`
- The cards align into a single project surface at the end of the scene.

### Scene 3 — One clear instruction, 0:08–0:15

- Transition into a faithful, simplified version of Vidrial’s real workspace UI.
- Show an authorised source asset already present in the project.
- Focus the AI instruction field and type a concise prompt, deterministically by frame:
  - `Find the strongest explanation, remove repetition, and build a 45-second first cut.`
- The submit action should feel immediate but deliberate.
- Show a restrained processing state with meaningful labels such as `Transcribing`, `Planning`, and `Preparing edit`; never use an indefinite spinner without context.
- Optional voiceover: “Start with your footage—and one clear instruction.”

### Scene 4 — Explainable intelligence, 0:15–0:25

- Reveal an AI edit plan as structured decisions, not magic sparkles.
- Animate three decisions into view:
  - `Open on the clearest claim`
  - `Remove repeated setup`
  - `Keep the supporting example`
- Connect each decision to a real-looking transcript range or timeline segment using fine lines and timecodes.
- Briefly expose an editable control or approval action so the viewer understands that the plan is reviewable.
- On-screen headline: `See the reasoning. Keep control.`
- Optional voiceover: “Vidrial turns transcripts into an explainable edit plan you can review before anything changes.”

### Scene 5 — The first cut assembles, 0:25–0:35

- Move into the timeline. Assemble three to five clips with precise magnetic motion.
- Add a playhead sweep, waveform continuity, caption track, and one restrained change in preview content.
- Demonstrate one edit adjustment: drag a cut point or restore a removed segment. Keep the interaction believable and readable.
- Show a vertical-output frame or reframing guide briefly, but do not imply an unsupported export destination.
- On-screen copy:
  - `Editable by design.`
  - `Ready for your judgment.`
- Optional voiceover: “Every cut stays editable—so the first version accelerates your work instead of replacing your judgment.”

### Scene 6 — From source to usable outputs, 0:35–0:43

- Show a clean project overview with authorised source media, a completed first cut, and two output aspect-ratio cards.
- If YouTube metadata is shown, clearly label it as `Reference` or `Metadata`; pair processing with an authorised source asset. Never show or say that Vidrial downloads arbitrary YouTube videos.
- Show captions and watermark/entitlement status as quiet, professional controls.
- On-screen headline: `From source to shareable cut—in one workspace.`
- Optional voiceover: “Move from authorised source media to reviewable, captioned outputs in one focused workspace.”

### Scene 7 — Brand close and CTA, 0:43–0:50

- Collapse the workspace into the Vidrial mark using the same geometry introduced in scene 1.
- Reveal the final statement over charcoal or warm white, whichever produces the strongest logo contrast under the brand guide:
  - `Your footage.`
  - `One prompt.`
  - `A finished first cut.`
- End with the real Vidrial wordmark, `vidrial.vercel.app`, and a restrained coral CTA pill reading `Create your first cut`.
- Hold the final frame long enough to read it. Resolve the music cleanly; do not cut the reverb tail abruptly.

## Audio direction

- Use a license-safe or newly generated instrumental bed with documented commercial-use rights. No copyrighted commercial track, vocals, recognizable melody, or unverified download.
- Target a modern editorial electronic sound: approximately 100–112 BPM, soft pulse, warm low percussion, subtle granular texture, and a confident final resolve.
- Add only a few original or properly licensed interface sounds: logo impact, prompt submit, plan reveal, timeline snap, and final CTA resolve.
- Store license/source details in a nearby `CREDITS.md`. If a usable licensed track is unavailable, create the video with a clearly named replaceable placeholder and document the exact replacement step—do not silently use an unlicensed file.
- Mix so narration remains intelligible. As a starting point, keep music around -20 LUFS under narration, duck it by roughly 6–9 dB during speech, avoid clipping, and apply short frame-based fades.
- Use Remotion-supported audio components (prefer the current `@remotion/media` audio API when compatible with the installed version). Drive volume, trims, and fades from frames.

## Narration and captions

- Include an optional voiceover track controlled by props. If no licensed or approved voice is available, render a no-voice master with complete on-screen storytelling and leave a documented voiceover script/timing sheet.
- Captions must be designed, not default subtitles: maximum two lines, high contrast, comfortable line length, and no collision with UI or safe areas.
- Do not generate a synthetic celebrity or imitate a recognizable person.

## Implementation requirements

- Keep the video code isolated from the web app while reusing safe brand tokens and logo geometry. Choose a location that matches the repository conventions, such as `src/remotion/` or a dedicated `video/` package; do not reorganize unrelated app code.
- Create small reusable components for:
  - brand token/theme access
  - logo reveal and wordmark lockup
  - editorial headline animation
  - product window/frame
  - cursor and deterministic typing
  - transcript decision rows
  - timeline clips, waveform, and playhead
  - stat/status chips
  - caption rendering
  - final CTA lockup
- Define a Zod-validated props schema for headline copy, URL, voiceover toggle, music toggle, and any replaceable assets.
- Preload fonts and media correctly. Use `staticFile()` for public assets. Never embed local absolute paths in the composition.
- Use deterministic seeded randomness if any noise or texture is generated.
- Avoid giant monolithic components. Scene components should each own their timing and remain easy to revise.
- Use semantic names and comments only where timing or a non-obvious visual construction needs explanation.
- Do not modify `src/routeTree.gen.ts` manually.

## Deliverables

1. The complete Remotion source and composition registration.
2. A `README.md` for the film containing:
   - exact preview command
   - exact still-render command
   - exact final-render command
   - asset replacement instructions
   - narration timing sheet
   - known limitations
3. `CREDITS.md` covering every external font, music, sound, image, icon, or other asset and its license/source URL.
4. Key-frame stills at approximately 2s, 11s, 20s, 30s, 39s, and 47s.
5. Final H.264 MP4 with AAC audio at 1920x1080, 30 fps. Also create a lightweight review encode if rendering cost is high.
6. A concise change summary listing exactly which product screens are faithful to the application and which elements are abstract representations.

## Verification gates

Do not declare completion until all applicable checks pass:

- run the repository’s existing typecheck, lint, unit tests, and build
- run any Remotion-specific typecheck/tests
- open the composition in Remotion Studio and inspect every scene transition
- render all requested stills and visually inspect them for overflow, clipped text, missing fonts, broken images, checkerboard artifacts, low contrast, and inconsistent spacing
- render the complete film and watch it from start to finish with audio
- confirm there are no blank frames, one-frame flashes, frame-rate-dependent animations, abrupt audio cuts, accidental scrollbars, or console errors
- verify the final frame holds long enough to read `vidrial.vercel.app`
- verify every third-party asset has a documented commercial-use license
- report any unavailable credential, asset, font license, render runtime, or unverified integration honestly; never fabricate success

When finished, commit only the files created or changed for this film using a clear conventional commit. Never amend, rebase, squash, or force-push published Lovable history.

---
