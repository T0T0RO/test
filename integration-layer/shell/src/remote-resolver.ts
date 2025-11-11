/**
 * remote-resolver.ts (Vite Federation edition)
 * --------------------------------------------
 * Unified runtime loader for Vite-based microfrontends (Angular, React, Vue).
 *
 * - Reads `remote-manifest.json` for available remotes
 * - Loads their remoteEntry URLs dynamically
 * - Uses OriginJS federation runtime (ESM style)
 * - Each remote must expose a `mount` and `unmount` function
 */

type FrameworkType = "angular" | "react" | "vue";

interface RemoteDefinition {
  name: string;
  url: string;
  type: FrameworkType;
  module?: string;
}

interface LoadedRemote {
  name: string;
  mount: (containerId: string) => Promise<void> | void;
  unmount: (containerId: string) => Promise<void> | void;
  type: FrameworkType;
}

const manifestUrl = "/src/remote-manifest.json";
const loadedRemotes = new Map<string, LoadedRemote>();

/**
 * Loads the remote manifest from the shell's local copy.
 */
async function loadManifest(): Promise<Record<string, RemoteDefinition>> {
  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch remote manifest: ${response.statusText}`);
  }
  return await response.json();
}

/**
 * Loads a remote entry script dynamically (via <script> tag).
 */
function loadRemoteEntry(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-remote-entry="${url}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = url;
    script.type = "module";
    script.async = true;
    script.dataset.remoteEntry = url;

    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load remote: ${url}`));

    document.head.appendChild(script);
  });
}

/**
 * Resolves a remote and returns its exported module API.
 */
export async function resolveRemote(remoteName: string): Promise<LoadedRemote> {
  if (loadedRemotes.has(remoteName)) {
    return loadedRemotes.get(remoteName)!;
  }

  const manifest = await loadManifest();
  const def = manifest[remoteName];
  if (!def) throw new Error(`Remote "${remoteName}" not found in manifest`);

  await loadRemoteEntry(def.url);

  // Import the exposed module using Vite federation ESM import
  const module = await import(/* @vite-ignore */ `${def.name}/${def.module ?? "remote"}`);

  const remote: LoadedRemote = {
    name: def.name,
    mount: module.mount,
    unmount: module.unmount,
    type: def.type,
  };

  loadedRemotes.set(def.name, remote);
  return remote;
}

/**
 * Mounts a remote into a DOM container.
 */
export async function mountRemote(remoteName: string, containerId: string): Promise<void> {
  const remote = await resolveRemote(remoteName);
  console.info(`[remote-resolver] Mounting ${remoteName} into #${containerId}`);
  await remote.mount(containerId);
}

/**
 * Unmounts a remote cleanly.
 */
export async function unmountRemote(remoteName: string, containerId: string): Promise<void> {
  const remote = loadedRemotes.get(remoteName);
  if (!remote) {
    console.warn(`[remote-resolver] Remote "${remoteName}" not loaded`);
    return;
  }

  console.info(`[remote-resolver] Unmounting ${remoteName} from #${containerId}`);
  await remote.unmount(containerId);
}
