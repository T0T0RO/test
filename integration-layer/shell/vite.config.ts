// integration-layer/shell/vite.config.ts
// MF2 shell Vite config (framework-agnostic host).
// Uses plain Vite; remotes are loaded via runtime/remoteLoader using remote-manifest.js.

import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: ".",
  plugins: [],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    target: "esnext",
    outDir: "dist",
    modulePreload: false,
    cssCodeSplit: true,
    rollupOptions: {
      // We keep this minimal; remotes are loaded at runtime from their built URLs/paths.
      external: []
    }
  }
});
