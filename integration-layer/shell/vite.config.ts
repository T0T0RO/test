// integration-layer/shell/vite.config.ts
// MF2 Shell Vite config — consume built remotes via /remotes/<name>/remoteEntry.js

import { defineConfig, type Plugin } from "vite";
import path from "path";
import fs from "fs";

const shellDir = __dirname;
const integrationRoot = path.resolve(shellDir, "..");
const configPath = path.resolve(integrationRoot, "remote-configs", "mfe.config.json");

type RemoteCfg = { name: string; root: string; framework?: string; version?: string; bootstrap?: string; };

function loadSSOT(): RemoteCfg[] {
  if (!fs.existsSync(configPath)) { console.warn(`[vite-config] mfe.config.json not found at ${configPath}`); return []; }
  try {
    const json = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const remotes: any = Array.isArray(json) ? json : json?.remotes;
    return Array.isArray(remotes) ? (remotes as RemoteCfg[]) : [];
  } catch (err: any) {
    console.warn(`[vite-config] Failed to parse mfe.config.json: ${err?.message || err}`); return [];
  }
}
function resolveRoot(p: string) { return path.isAbsolute(p) ? p : path.resolve(integrationRoot, p); }
function buildAliasesAndFsAllow(remotes: RemoteCfg[]) {
  const aliases: Record<string, string> = {};
  const fsAllow: string[] = [];
  for (const r of remotes) {
    if (!r?.name || !r?.root) continue;
    const remoteRoot = resolveRoot(r.root);
    const distEntry = path.resolve(remoteRoot, "dist", "remoteEntry.js");
    aliases[`/remotes/${r.name}/remoteEntry.js`] = distEntry;
    fsAllow.push(remoteRoot, path.resolve(remoteRoot, "dist"));
  }
  fsAllow.push(shellDir, integrationRoot, path.resolve(integrationRoot, ".."));
  return { aliases, fsAllow };
}

function guardNoRemoteSrc(remotes: RemoteCfg[]): Plugin {
  const roots = remotes.map(r => resolveRoot(r.root).replace(/\\/g, "/"));
  return {
    name: "mf2-guard-no-remote-src",
    enforce: "pre",
    resolveId(id) {
      if (id.startsWith("/@fs/")) {
        const p = id.slice(4).replace(/\\/g, "/");
        for (const root of roots) if (p.startsWith(root) && p.includes("/src/")) this.warn(`[mf2] Disallowed import from remote source: ${id}`);
      }
      return null;
    }
  };
}

function staticDistMiddleware(remotes: RemoteCfg[]): Plugin {
  const byName = new Map(remotes.map(r => [r.name, r]));
  return {
    name: "mf2-static-dist",
    configureServer(server) {
      server.middlewares.use((req: any, res: any, next: any) => {
        try {
          const url = req.url || "/";
          const m = url.match(/^\/remotes\/([^/]+)\/(.*)$/);
          if (!m) return next();
          const [, name, rest] = m;
          const cfg = byName.get(name);
          if (!cfg) return next();

          const distRoot = path.join(resolveRoot(cfg.root), "dist");
          const fsPath = path.join(distRoot, rest.replace(/^\/+/, ""));
          if (fs.existsSync(fsPath) && fs.statSync(fsPath).isFile()) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            if (fsPath.endsWith(".mjs") || fsPath.endsWith(".js")) res.setHeader("Content-Type", "text/javascript");
            else if (fsPath.endsWith(".css")) res.setHeader("Content-Type", "text/css");
            else if (fsPath.endsWith(".svg")) res.setHeader("Content-Type", "image/svg+xml");
            fs.createReadStream(fsPath).pipe(res); return;
          }
          return next();
        } catch { return next(); }
      });
    }
  };
}

const remotes = loadSSOT();
const { aliases: remoteAliases, fsAllow } = buildAliasesAndFsAllow(remotes);

console.log("[vite-config] Build-only remote aliases:");
for (const [k, v] of Object.entries(remoteAliases)) console.log("  ", k, "→", v);

export default defineConfig({
  root: ".",
  plugins: [guardNoRemoteSrc(remotes), staticDistMiddleware(remotes)],
  resolve: { alias: { "@": path.resolve(shellDir, "src"), ...remoteAliases } },
  server: { port: 5173, strictPort: false, fs: { allow: fsAllow } },
  build: { target: "esnext", outDir: "dist", modulePreload: false, cssCodeSplit: true, rollupOptions: { external: [] } }
});
