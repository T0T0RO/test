/*import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import angular from "@analogjs/vite-plugin-angular"; // <- official Nx plugin
import { federation } from "@module-federation/vite";

export default defineConfig({
  plugins: [
    angular(),
    tsconfigPaths(),
    federation({
      name: "shell",
      filename: "remoteEntry.js",
      exposes: {
        "./RemoteModule": "./src/app/app.module.ts", // optional; not used by dynamic import approach
      },
      shared: {
        "@angular/core": { singleton: true, requiredVersion: "auto" },
        "@angular/common": { singleton: true, requiredVersion: "auto" },
        "@angular/router": { singleton: true, requiredVersion: "auto" },
      },
    }),
  ],
  server: {
    port: 4210,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      external: ["@angular/core", "@angular/common", "@angular/router"],
    },
  },
});*/

// angular-vite-mf2-bucketed-poc/shell/vite.config.ts
import { defineConfig } from "vite";
import federation from "@originjs/vite-plugin-federation";
import { getFederationRemotes } from "./src/remote-resolver";

export default defineConfig({
  plugins: [
    federation({
      name: "shell",
      filename: "remoteEntry.js",
      remotes: getFederationRemotes(),
      exposes: {},
      shared: ["react", "react-dom", "vue", "@angular/core"]
    })
  ],
  server: {
    port: 5173
  },
  build: {
    target: "esnext"
  }
});

