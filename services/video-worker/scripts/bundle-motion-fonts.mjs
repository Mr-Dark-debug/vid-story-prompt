import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const target = resolve(process.argv[2] ?? "motion-fonts");
await mkdir(target, { recursive: true });
const fonts = [
  ["manrope", "Manrope", "manrope-latin-400-normal.woff2"],
  ["jetbrains-mono", "JetBrains Mono", "jetbrains-mono-latin-400-normal.woff2"],
  ["eb-garamond", "EB Garamond", "eb-garamond-latin-400-normal.woff2"],
];
let css = "";
for (const [pkg, family, file] of fonts) {
  const base = resolve("node_modules", "@fontsource", pkg);
  css += `@font-face{font-family:"${family}";font-style:normal;font-weight:400;font-display:block;src:url(data:font/woff2;base64,${(await readFile(resolve(base, "files", file))).toString("base64")}) format("woff2")}\n`;
  await writeFile(resolve(target, `${pkg}-LICENSE.txt`), await readFile(resolve(base, "LICENSE")));
}
await writeFile(resolve(target, "fonts.css"), css);
