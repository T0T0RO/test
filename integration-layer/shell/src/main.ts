// integration-layer/shell/src/main.ts
import { listAvailableRemotes, mountRemote, unmountRemote, logManifestSummary } from "./runtime/remoteLoader";

function qs<T extends Element = Element>(sel: string): T {
  const el = document.querySelector(sel); if (!el) throw new Error(`Missing element: ${sel}`); return el as T;
}
function ensureHost(): HTMLElement { return qs<HTMLElement>("#mfe-host"); }

let current: string | null = null;

async function switchTo(name: string) {
  const host = ensureHost();
  if (current) await unmountRemote(current, host);
  host.innerHTML = "";
  current = name;
  await mountRemote(name, host);
  (qs("#status") as HTMLElement).textContent = `mounted: ${name}`;
}

async function init() {
  logManifestSummary();
  const names = listAvailableRemotes();
  if (names.length === 0) { (qs("#status") as HTMLElement).textContent = "no available remotes"; return; }

  document.getElementById("btn-app-react")?.addEventListener("click", () => switchTo("app-react"));
  document.getElementById("btn-app1")?.addEventListener("click", () => switchTo("app1"));
  document.getElementById("btn-app2")?.addEventListener("click", () => switchTo("app2"));

  await switchTo(names[0]);
}

init().catch((e) => { console.error("[shell] init failed:", e); });
