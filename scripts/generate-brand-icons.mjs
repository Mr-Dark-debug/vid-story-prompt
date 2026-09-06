import { readFile, writeFile, mkdir } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";

// Compile browser assets from the shared logo; never substitute a template icon.
const source = await readFile(
  new URL("../src/components/primitives/logo.tsx", import.meta.url),
  "utf8",
);
const paths = [...source.matchAll(/<path fill="currentColor" d="([^"]+)"/g)].map(
  (match) => match[1],
);
if (paths.length !== 2) throw new Error("Expected the two canonical Vidrial logo paths.");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#1D1D1B"/><g transform="translate(10 10) scale(.8)" fill="#F6F7F7">${paths.map((d) => `<path d="${d}"/>`).join("")}</g></svg>\n`;
const root = new URL("../public/", import.meta.url);
await mkdir(new URL("icons/", root), { recursive: true });
await writeFile(new URL("favicon.svg", root), svg);
await writeFile(new URL("icons/vidrial-v3.svg", root), svg);
const icons = new Map();
for (const size of [16, 32, 48, 120, 180, 192, 512]) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  icons.set(size, png);
  await writeFile(new URL(`icons/vidrial-${size}-v3.png`, root), png);
}
// ICO supports embedded PNG images. Include the usual browser/Windows sizes.
const sizes = [16, 32, 48];
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, index) => {
  const position = 6 + index * 16;
  const png = icons.get(size);
  header[position] = size;
  header[position + 1] = size;
  header.writeUInt16LE(1, position + 4);
  header.writeUInt16LE(32, position + 6);
  header.writeUInt32LE(png.length, position + 8);
  header.writeUInt32LE(offset, position + 12);
  offset += png.length;
});
const ico = Buffer.concat([header, ...sizes.map((size) => icons.get(size))]);
await writeFile(new URL("favicon.ico", root), ico);
await writeFile(new URL("icons/vidrial-v3.ico", root), ico);
console.log("Generated Vidrial SVG, ICO and PNG browser icons from LogoMark.");
