# Third-party notices

## Motion Studio content provenance

The official briefs in `content/motion/prompts.json`, guide text and authored demo scenes are original Vidrial work. Competitor pages informed page structure only. No competitor prompts, media, creator identities or engagement figures are bundled. Demo scenes are explicitly authored illustrations, not represented as outputs of a named model.

The design references these upstream projects. Any adapted code must retain the actual applicable upstream copyright and license notice in the corresponding source or notice file:

- [BreakDimbo/javascript-animation-skills](https://github.com/BreakDimbo/javascript-animation-skills)
- [iart-ai/motion-skills](https://github.com/iart-ai/motion-skills)
- [hculap/skill-motion-graphic](https://github.com/hculap/skill-motion-graphic)
- [alsharmani0/canvas-animation-skills](https://github.com/alsharmani0/canvas-animation-skills)
- [kiselas/every-frame-is-code](https://github.com/kiselas/every-frame-is-code)

Claude and Anthropic names belong to their respective owners. Vidrial is not affiliated with Anthropic.

## Renderer research and implementation provenance

The seek contract and staged beat-sheet/review workflow were implemented independently after reading the accessible upstream SKILL/reference documents. BreakDimbo/javascript-animation-skills and iart-ai/motion-skills identify their MIT copyright as `Copyright (c) 2026 iart.ai`; kiselas/every-frame-is-code identifies `Copyright (c) 2026 Aleksandr`. Their MIT permission notice is reproduced below. No upstream scenes, prompts, videos or artwork are bundled. hculap/skill-motion-graphic had no license file in the inspected checkout, so no code was copied from it. alsharmani0/canvas-animation-skills was unavailable, so no content was used. HyperFrames (Apache-2.0) was evaluated; no code was incorporated. Remotion is not included.

MIT License

Copyright (c) 2026 iart.ai
Copyright (c) 2026 Aleksandr

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Playwright security profile

`services/video-worker/motion-seccomp.json` is the Microsoft Playwright v1.61.1 Docker seccomp profile, obtained from [the pinned source](https://github.com/microsoft/playwright/blob/v1.61.1/utils/docker/seccomp_profile.json). Playwright is Copyright Microsoft Corporation and distributed under [Apache License 2.0](https://github.com/microsoft/playwright/blob/v1.61.1/LICENSE). The profile is retained unchanged. A copy of its Apache license is in `docs/licenses/playwright-APACHE-2.0.txt`.

## Bundled fonts

Manrope, JetBrains Mono and EB Garamond are pinned Fontsource 5.2.6 packages. Their distributed license is the SIL Open Font License 1.1, Google Inc. A complete notice is in `docs/motion-fonts-OFL.txt`; individual package notices are also copied into the renderer image under `/usr/share/licenses/vidrial-motion`. Only the licensed Latin normal-400 files are bundled. Manrope is the product typography; the other families are available to authored motion scenes. Museum Sans is not bundled.
