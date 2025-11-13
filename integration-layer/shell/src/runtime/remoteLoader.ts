// integration-layer/shell/src/runtime/remoteLoader.ts
import * as manifestMod from "../remote-manifest";
import type { RemoteManifestEntry } from "../remote-manifest";

type RemoteManifest = Record<string, RemoteManifestEntry>;

function toAlias(name: string) { return `/remotes/${name}/remoteEntry.js`; }

function normalizeManifest(raw: any): RemoteManifest {
  if (raw?.remoteManifest && typeof raw.remoteManifest === "object" && !Array.isArray(raw.remoteManifest)) {
    return raw.remoteManifest as RemoteManifest;
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw) && raw["app-react"]?.entry) {
    return raw as RemoteManifest;
  }
  const legacy = raw?.default || raw;
  if (legacy?.remotes && Array.isArray(legacy.remotes)) {
    const map: RemoteManifest = {};
    for (const r of legacy.remotes) {
      const name = r?.name; if (!name) continue;
      map[name] = {
        entry: toAlias(name),
        framework: r.framework || "unknown",
        version: r.version || "X",
        status: r.status || (r.entry ? "available" : "missing")
      };
    }
    console.warn("[MF2] Adapted legacy manifest shape at runtime; please regenerate.");
    return map;
  }
  console.error("[MF2] Unsupported manifest shape. Regenerate the manifest.");
  return {};
}

const manifest: RemoteManifest = normalizeManifest(manifestMod);

export type LoadedRemote = {
  meta: { name: string; framework: string; version: string };
  mount: (container: HTMLElement, props?: any) => Promise<any> | any;
  unmount: (container: HTMLElement) => Promise<any> | any;
};

export function getRemoteEntry(remoteName: string): RemoteManifestEntry | null {
  const entry = manifest[remoteName];
  if (!entry) { console.warn(`[MF2] getRemoteEntry: Remote "${remoteName}" not found in manifest.`); return null; }
  return entry;
}

export async function loadRemote(remoteName: string): Promise<LoadedRemote | null> {
  const entry = getRemoteEntry(remoteName);
  if (!entry) return null;
  if (entry.status !== "available" || !entry.entry) { console.warn(`[MF2] loadRemote: "${remoteName}" not available (status="${entry.status}").`); return null; }
  try {
    const mod: any = await import(/* @vite-ignore */ entry.entry);
    if (!mod || typeof mod.mount !== "function" || typeof mod.unmount !== "function") {
      console.error(`[MF2] loadRemote: Invalid module for "${remoteName}" at "${entry.entry}".`); return null;
    }
    return mod as LoadedRemote;
  } catch (err) {
    console.error(`[MF2] loadRemote: Failed to import "${remoteName}" from "${entry.entry}".`, err); return null;
  }
}

export async function mountRemote(remoteName: string, container: HTMLElement, props?: any): Promise<void> {
  const mod = await loadRemote(remoteName);
  if (!mod) { console.warn(`[MF2] mountRemote: Remote "${remoteName}" could not be loaded.`); return; }
  await mod.mount(container, props);
}

export async function unmountRemote(remoteName: string, container: HTMLElement): Promise<void> {
  const mod = await loadRemote(remoteName);
  if (!mod) { console.warn(`[MF2] unmountRemote: Remote "${remoteName}" could not be loaded for unmount.`); return; }
  await mod.unmount(container);
}

export function listAvailableRemotes(): string[] {
  return Object.entries(manifest)
    .filter(([, entry]) => entry.status === "available" && !!entry.entry)
    .map(([name]) => name);
}

export function logManifestSummary(): void {
  const rows = Object.entries(manifest).map(([name, entry]) => ({
    name, framework: entry.framework, version: entry.version, status: entry.status, entry: entry.entry
  }));
  console.table(rows); // eslint-disable-line no-console
}
