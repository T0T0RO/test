// integration-layer/shell/src/main.ts
import {
  listAvailableRemotes,
  mountRemote,
  unmountRemote,
  logManifestSummary,
} from "./runtime/remoteLoader";

function qs<T extends Element = Element>(sel: string): T {
  const el = document.querySelector(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el as T;
}

function ensureHost(): HTMLElement {
  return qs<HTMLElement>("#mfe-host");
}

let current: string | null = null;

async function switchTo(name: string) {
  const host = ensureHost();

  if (current === name) return;

  if (current) {
    try {
      await unmountRemote(current, host);
    } catch (err) {
      console.warn("[shell] unmount failed:", err);
    }
  }

  host.innerHTML = "";
  current = name;

  try {
    await mountRemote(name, host);
    (qs("#status") as HTMLElement).textContent = `mounted: ${name}`;
  } catch (err) {
    console.error("[shell] mount failed:", err);
    (qs("#status") as HTMLElement).textContent = `error mounting: ${name}`;
  }
}

function wireButton(remoteName: string, buttonId: string, available: string[]) {
  const btn = document.getElementById(buttonId) as HTMLButtonElement | null;
  if (!btn) {
    console.warn(`[shell] missing button #${buttonId}`);
    return;
  }

  if (!available.includes(remoteName)) {
    btn.disabled = true;
    btn.title = "Remote not available (missing or failed build)";
    return;
  }

  btn.addEventListener("click", () => {
    switchTo(remoteName).catch((e) => console.error("[shell] switchTo error:", e));
  });
}

async function init() {
  logManifestSummary();
  const names = listAvailableRemotes();

  if (names.length === 0) {
    (qs("#status") as HTMLElement).textContent = "no available remotes";
    return;
  }

  // Wire all five remotes, but only enable those actually present in manifest
  wireButton("app-react", "btn-app-react", names);
  wireButton("app1", "btn-app1", names);
  wireButton("app2", "btn-app2", names);
  wireButton("app3", "btn-app3", names);
  wireButton("app-vue", "btn-app-vue", names);
  wireButton("app-vanilla", "btn-app-vanilla", names);

  await switchTo(names[0]);
}

init().catch((e) => {
  console.error("[shell] init failed:", e);
});
