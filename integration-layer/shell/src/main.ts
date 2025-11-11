// integration-layer/shell/src/main.ts
// MF2 shell entrypoint (framework-agnostic).
// Renders a simple UI and mounts the first available remote as a demo.

import {
  listAvailableRemotes,
  mountRemote,
  unmountRemote,
  logManifestSummary,
} from "./runtime/remoteLoader";

function ensureRoot(): HTMLElement {
  const existing = document.getElementById("app");
  if (existing) return existing;

  const el = document.createElement("div");
  el.id = "app";
  document.body.appendChild(el);
  return el;
}

async function bootstrap() {
  const root = ensureRoot();

  root.innerHTML = `
    <div style="font-family: system-ui, sans-serif; padding: 16px;">
      <h1 style="margin: 0 0 8px;">MF2 Shell</h1>
      <div id="mf2-remote-list" style="margin-bottom: 8px; font-size: 14px;"></div>
      <div id="mf2-remote-container" style="border: 1px solid #ccc; padding: 8px; min-height: 80px;">
        Loading remote...
      </div>
    </div>
  `;

  const listEl = document.getElementById("mf2-remote-list");
  const container = document.getElementById("mf2-remote-container");

  if (!listEl || !container) {
    // Hard fail: shell DOM is broken
    throw new Error("[MF2] Shell DOM structure missing.");
  }

  logManifestSummary();

  const available = listAvailableRemotes();
  if (available.length === 0) {
    listEl.textContent = "No available remotes found in manifest.";
    container.textContent = "";
    return;
  }

  listEl.textContent = `Available remotes: ${available.join(", ")}`;

  const targetRemote = available[0];

  // Clean up handle
  let cleanup: (() => Promise<void> | void) | null = null;

  const mountSelected = async (remoteName: string) => {
    if (cleanup && container.firstChild) {
      await cleanup();
      cleanup = null;
      container.innerHTML = "";
    }

    container.innerHTML = `Mounting "${remoteName}"...`;
    await mountRemote(remoteName, container, {});
    cleanup = async () => {
      await unmountRemote(remoteName, container);
    };
  };

  await mountSelected(targetRemote);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[MF2] Shell bootstrap failed:", err);
  const root = ensureRoot();
  root.innerHTML = `<pre style="color:red;">Shell bootstrap failed: ${String(err)}</pre>`;
});
