// integration-layer/shell/src/runtime/remoteLoader.ts
// Dynamic remote loader for MF2 shell.
// Consumes generated remote-manifest.js and exposes mount/unmount helpers.

import { remoteManifest } from "../remote-manifest";
import type { RemoteManifestEntry } from "../remote-manifest";

type RemoteManifest = Record<string, RemoteManifestEntry>;

const manifest: RemoteManifest = remoteManifest as RemoteManifest;

export type LoadedRemote = {
  meta: { name: string; framework: string; version: string };
  mount: (container: HTMLElement, props?: any) => Promise<any> | any;
  unmount: (container: HTMLElement) => Promise<any> | any;
};

/**
 * Returns the manifest entry for a given remote.
 */
export function getRemoteEntry(remoteName: string): RemoteManifestEntry | null {
  const entry = manifest[remoteName];
  if (!entry) {
    console.warn(`[MF2] getRemoteEntry: Remote "${remoteName}" not found in manifest.`);
    return null;
  }
  return entry;
}

/**
 * Dynamically imports a remote’s remoteEntry.js module.
 */
export async function loadRemote(remoteName: string): Promise<LoadedRemote | null> {
  const entry = getRemoteEntry(remoteName);
  if (!entry) {
    return null;
  }

  if (entry.status !== "available" || !entry.entry) {
    console.warn(
      `[MF2] loadRemote: Remote "${remoteName}" is not available (status="${entry.status}").`
    );
    return null;
  }

  try {
    const mod: any = await import(
      /* @vite-ignore */
      entry.entry
    );

    if (!mod || typeof mod.mount !== "function" || typeof mod.unmount !== "function") {
      console.error(
        `[MF2] loadRemote: Invalid module for "${remoteName}" at "${entry.entry}" (missing mount/unmount).`
      );
      return null;
    }

    return mod as LoadedRemote;
  } catch (err) {
    console.error(
      `[MF2] loadRemote: Failed to import remote "${remoteName}" from "${entry.entry}".`
    );
    console.error(err);
    return null;
  }
}

/**
 * Mounts a remote into the given DOM container.
 */
export async function mountRemote(
  remoteName: string,
  container: HTMLElement,
  props?: any
): Promise<void> {
  const mod = await loadRemote(remoteName);
  if (!mod) {
    console.warn(`[MF2] mountRemote: Remote "${remoteName}" could not be loaded.`);
    return;
  }

  await mod.mount(container, props);
}

/**
 * Unmounts a remote from the given DOM container.
 */
export async function unmountRemote(
  remoteName: string,
  container: HTMLElement
): Promise<void> {
  const mod = await loadRemote(remoteName);
  if (!mod) {
    console.warn(
      `[MF2] unmountRemote: Remote "${remoteName}" could not be loaded for unmount.`
    );
    return;
  }

  await mod.unmount(container);
}

/**
 * Returns a list of available remote names.
 */
export function listAvailableRemotes(): string[] {
  return Object.entries(manifest)
    .filter(([_, entry]) => entry.status === "available" && !!entry.entry)
    .map(([name]) => name);
}

/**
 * Logs a concise summary of the manifest.
 */
export function logManifestSummary(): void {
  const rows = Object.entries(manifest).map(([name, entry]) => ({
    name,
    framework: entry.framework,
    version: entry.version,
    status: entry.status,
    entry: entry.entry,
  }));
  // eslint-disable-next-line no-console
  console.table(rows);
}
