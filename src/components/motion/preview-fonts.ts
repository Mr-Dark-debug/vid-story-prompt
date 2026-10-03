import manrope from "@fontsource/manrope/files/manrope-latin-400-normal.woff2?inline";
import mono from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?inline";
import serif from "@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2?inline";

// Licensed data URLs keep opaque previews offline and match the renderer's font set.
export const MOTION_PREVIEW_FONT_CSS = [
  ["Manrope", manrope],
  ["JetBrains Mono", mono],
  ["EB Garamond", serif],
]
  .map(
    ([family, url]) =>
      `@font-face{font-family:"${family}";font-weight:400;font-style:normal;font-display:block;src:url("${url}") format("woff2")}`,
  )
  .join("\n");
