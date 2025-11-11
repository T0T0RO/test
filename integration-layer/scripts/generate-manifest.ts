// angular-vite-mf2-bucketed-poc/scripts/generate-manifest.ts
import fs from "fs";
import path from "path";

type MfeConfig = {
  name: string;
  root: string;      // relative path from shell root to the app folder (e.g. ../simple_react_app/app-react)
  framework?: string;
  version?: string;
};

const ROOT = path.resolve(__dirname, ".."); // angular-vite-mf2-bucketed-poc
const CONFIG_PATH = path.join(ROOT, "mfe.config.json");
const OUT_PATH = path.join(ROOT, "shell", "src", "remote-manifest.json");

if (!fs.existsSync(CONFIG_PATH)) {
  console.error(`mfe.config.json not found at ${CONFIG_PATH}`);
  process.exit(1);
}

const raw = fs.readFileSync(CONFIG_PATH, "utf8");
const mfes: MfeConfig[] = JSON.parse(raw) as MfeConfig[];

/**
 * Adjust this mapping to match how you run apps locally.
 * Map an app root (or part of it) to the dev server port you run it on.
 */
function portFor(appRoot: string): number | null {
  // Examples - change as necessary
  if (appRoot.includes("app-react")) return 4212;
  if (appRoot.includes("app-vue")) return 4213;
  if (appRoot.includes("app1")) return 4211;
  if (appRoot.includes("app2")) return 4214;
  if (appRoot.includes("app-vite-vanilla")) return 4215;
  // fallback: unknown
  return null;
}

/**
 * Look for built remote entry (dist) or fall back to dev source path.
 * Returns an object with the final URL the shell should import at runtime.
 */
function findRemoteUrl(mfe: MfeConfig) {
  const appAbs = path.resolve(ROOT, mfe.root);
  const distDir = path.join(appAbs, "dist");
  if (fs.existsSync(distDir) && fs.statSync(distDir).isDirectory()) {
    const files = fs.readdirSync(distDir);
    const candidate = files.find((f) => /^remote-entry(\..*)?\.mjs$|^remote-entry(\..*)?\.js$/.test(f));
    if (candidate) {
      // If you host dist at e.g. /remotes/<name>/, adapt as needed. Here we default to a localhost dev mapping if port known.
      const p = portFor(mfe.root);
      if (p) {
        return `http://localhost:${p}/${candidate}`;
      }
      // fallback to a relative path to dist (useful for static hosting)
      return `/${path.relative(path.join(ROOT, "shell", "public"), path.join(distDir, candidate)).replace(/\\\\/g, "/")}`;
    }
  }

  // fallback: assume the dev server serves the source file at:
  // http://localhost:<port>/src/remote-entry.ts  (works with Vite dev server)
  const devPort = portFor(mfe.root);
  if (devPort) return `http://localhost:${devPort}/src/remote-entry.ts`;
  // final fallback - try relative file path (rare)
  return path.join(appAbs, "src", "remote-entry.ts");
}

/**
 * Build manifest object: { [name]: { url, framework, version } }
 */
const manifest: Record<string, { url: string; framework?: string; version?: string }> = {};

for (const mfe of mfes) {
  try {
    const url = findRemoteUrl(mfe);
    manifest[mfe.name] = {
      url,
      framework: mfe.framework,
      version: mfe.version ?? "X",
    };
  } catch (err) {
    console.warn(`Skipping ${mfe.name}: ${String(err)}`);
  }
}

// ensure output dir exists
const outDir = path.dirname(OUT_PATH);
fs.mkdirSync(outDir, { recursive: true });

// write file
fs.writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2), "utf8");
console.log(`Wrote ${Object.keys(manifest).length} remotes to ${OUT_PATH}`);
