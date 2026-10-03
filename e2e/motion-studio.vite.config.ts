import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
const file = (path: string) => fileURLToPath(new URL(path, import.meta.url));
export default defineConfig({
  root: file("./motion-studio-fixture"),
  publicDir: file("../public"),
  envDir: false,
  cacheDir: file("../node_modules/.vite-motion-studio-e2e"),
  plugins: [react(), tailwind()],
  resolve: {
    alias: [
      { find: "@/components/app/layout", replacement: file("./motion-studio-fixture/layout.tsx") },
      {
        find: /^@\/services\/(motion\/server|auth)$/,
        replacement: file("./motion-studio-fixture/providers.ts"),
      },
      { find: "@/lib/supabase/client", replacement: file("./motion-studio-fixture/providers.ts") },
      { find: "@tanstack/react-router", replacement: file("./motion-studio-fixture/router.tsx") },
      { find: "@", replacement: file("../src") },
    ],
  },
  server: { host: "127.0.0.1", port: 4192, strictPort: true, fs: { allow: [file("..")] } },
});
