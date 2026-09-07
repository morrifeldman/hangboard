import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import type { Plugin } from "vite";

/**
 * Serve /api/fetch-mp-csv during `npm run dev`.
 *
 * `api/` is a Vercel convention: in production Vercel runs api/fetch-mp-csv.js
 * as a serverless function, but Vite knows nothing about that and used to serve
 * the handler's own JavaScript source as a static file. The app then parsed
 * that source as a CSV, found no climbs in it, and replaced the whole climb
 * database with an empty list. This keeps the two environments in step; the
 * import guards in src/lib/mpRefresh.ts are the second line of defence.
 *
 * Keep the behaviour here in sync with api/fetch-mp-csv.js.
 */
function mpCsvDevEndpoint(): Plugin {
  return {
    name: "mp-csv-dev-endpoint",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/fetch-mp-csv", async (req, res) => {
        const send = (status: number, body: string, type = "application/json") => {
          res.statusCode = status;
          res.setHeader("Content-Type", type);
          res.end(body);
        };

        if (req.method !== "GET") {
          return send(405, JSON.stringify({ error: "Method not allowed" }));
        }

        const url = new URL(req.url ?? "", "http://localhost").searchParams.get("url");
        if (!url) {
          return send(400, JSON.stringify({ error: "URL parameter is required" }));
        }
        if (!url.includes("mountainproject.com") || !url.includes("tick-export")) {
          return send(400, JSON.stringify({ error: "Invalid Mountain Project URL" }));
        }

        try {
          const upstream = await fetch(url);
          if (!upstream.ok) {
            throw new Error(`HTTP ${upstream.status}: ${upstream.statusText}`);
          }
          send(200, await upstream.text(), "text/csv");
        } catch (error) {
          send(
            500,
            JSON.stringify({
              error: "Failed to fetch CSV data",
              details: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [
    mpCsvDevEndpoint(),
    react(),
    VitePWA({
      // Custom service worker (src/sw.ts) so we can handle Periodic Background
      // Sync for background daily reminders. The SW is bundled by Vite/esbuild,
      // which sidesteps the workbox-build terser worker-pool hang that forced
      // workbox.mode: "development" under the old generateSW strategy.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
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
    }),
  ],
});
