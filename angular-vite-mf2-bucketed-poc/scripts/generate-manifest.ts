// File: angular-vite-mf2-bucketed-poc/scripts/generate-manifest.ts
import fs from 'fs';
import path from 'path';

interface RemoteDef {
  name: string;
  type: 'react' | 'vue' | 'angular' | string;
  url: string;
}
interface Manifest {
  remotes: RemoteDef[];
}

const BASE_PATHS = [
  '../simple_react_app/app-react/dist',
  '../simple-vue_app/app-vue/dist',
  '../simple_angular_app/app1/dist',
  '../simple_angular_app/app2/dist'
];

const OUTPUT_PATH = path.resolve(__dirname, '../shell/src/remote-manifest.json');

function findRemoteEntries(): RemoteDef[] {
  const found: RemoteDef[] = [];

  for (const rel of BASE_PATHS) {
    const absPath = path.resolve(__dirname, rel);
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
      console.warn(`Skipping path (not found or not dir): ${absPath}`);
      continue;
    }
    const files = fs.readdirSync(absPath);
    for (const f of files) {
      if (/^remote-entry(\..*)?\.mjs$/.test(f) || /^remote-entry(\..*)?\.js$/.test(f)) {
        const name = path.basename(path.dirname(absPath));
        const url = `http://localhost:${getPortForPath(absPath)}/${f}`;
        const type = inferFrameworkFromPath(absPath);
        found.push({ name, type, url });
      }
    }
  }
  return found;
}

function getPortForPath(absPath: string): number {
  // map folder -> port
  if (absPath.includes('app-react')) return 4212;
  if (absPath.includes('app-vue'))   return 4213;
  if (absPath.includes('app1'))      return 4211;
  if (absPath.includes('app2'))      return 4214;
  return 0;
}

function inferFrameworkFromPath(absPath: string): 'react' | 'vue' | 'angular' {
  if (absPath.includes('app-react')) return 'react';
  if (absPath.includes('app-vue'))   return 'vue';
  return 'angular';
}

function writeManifest(remotes: RemoteDef[]) {
  const manifest: Manifest = { remotes };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`Generated manifest with ${remotes.length} remotes to ${OUTPUT_PATH}`);
}

function main() {
  const remotes = findRemoteEntries();
  if (remotes.length === 0) {
    console.warn('No remote entries found.');
  }
  writeManifest(remotes);
}

main();
