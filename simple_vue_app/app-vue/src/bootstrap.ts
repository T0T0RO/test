// simple_vue_app/app-vue/src/bootstrap.ts
// MF2-specific bootstrap for Vue 3 remote.
// IMPORTANT: do NOT import .vue SFCs here – esbuild (generate-remote-entry.mjs)
// does not have a .vue loader. Keep this file pure TS/JS.

import { createApp, h } from "vue";

let app: ReturnType<typeof createApp> | null = null;
let hostRoot: HTMLElement | null = null;

export async function bootstrap(container: HTMLElement) {
  if (!container) throw new Error("[app-vue] bootstrap: container is required");

  // If already mounted into this container, do nothing
  if (hostRoot && hostRoot.parentElement === container && app) {
    return;
  }

  // Create a wrapper inside the container – MF2 invariant: no global #app.
  hostRoot = document.createElement("div");
  container.appendChild(hostRoot);

  app = createApp({
    name: "VueRemoteRoot",
    setup() {
      return () =>
        h("div", { class: "mfe-card" }, [
          h("h2", "Vue Remote: app-vue"),
          h("p", "Hello from Vue remote MF2 mount."),
        ]);
    },
  });

  app.mount(hostRoot);
  console.info("[app-vue] mounted into MF2 host");
}

export async function teardown(container: HTMLElement) {
  if (!container) return;

  try {
    if (app) {
      app.unmount();
    }
  } catch (e) {
    console.warn("[app-vue] error during unmount", e);
  }

  if (hostRoot && container.contains(hostRoot)) {
    try {
      container.removeChild(hostRoot);
    } catch {
      /* ignore best-effort cleanup */
    }
  }

  app = null;
  hostRoot = null;
  console.info("[app-vue] unmounted from MF2 host");
}

export default { bootstrap, teardown };
