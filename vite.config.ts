import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Cairn",
        short_name: "Cairn",
        description: "Personal climbing training app",
        theme_color: "#111827",
        background_color: "#111827",
        display: "standalone",
        orientation: "portrait",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        // Workaround for workbox-build 7.4.1 + @rollup/plugin-terser 1.0.0
        // worker-pool race: the terser plugin's renderChunk hook returns
        // before its worker_threads close, leaving `npm run build` hanging
        // with "Unable to write the service worker file. Unfinished hook
        // action(s) on exit: (terser) renderChunk" and dist/sw.js missing.
        // mode: "development" skips workbox's internal terser pass; the only
        // user-visible effect is the SW is unminified (~3.5 KB) and keeps a
        // few workbox-runtime console.logs. Caching behavior is unchanged.
        mode: "development",
      },
    }),
  ],
});
