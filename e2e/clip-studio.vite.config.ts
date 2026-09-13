import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
const file = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  root: file("./clip-studio-fixture"),
  cacheDir: file("../node_modules/.vite-clip-studio-e2e"),
  envDir: false,
  plugins: [react(), tailwind()],
  resolve: {
    alias: [
      {
        find: /^@\/services\/(?:.*server|analytics\/client|storage\/resumable-upload)$/,
        replacement: file("./clip-studio-fixture/providers.ts"),
      },
      { find: "@tanstack/react-router", replacement: file("./clip-studio-fixture/router.ts") },
      { find: "@", replacement: file("../src") },
    ],
  },
  server: { host: "127.0.0.1", port: 4174, strictPort: true, fs: { allow: [file("..")] } },
});
