import { createApp, type App as VueApp } from "vue";
import RootApp from "./App.vue";

let vm: VueApp | null = null;

export const meta = {
  name: "app-vue",
  framework: "vue",
  version: "0.0.0"
};

export async function bootstrap(container: HTMLElement, props?: any) {
  if (!container) {
    throw new Error("bootstrap: container is required");
  }

  if (vm) {
    // Already mounted; naive idempotence (could be improved if needed)
    return vm;
  }

  const app = createApp(RootApp, props || {});
  vm = app;
  app.mount(container);

  return vm;
}

export async function teardown(container: HTMLElement) {
  if (vm) {
    try {
      vm.unmount();
    } catch {
      // ignore
    }
    vm = null;
  }

  if (container) {
    container.innerHTML = "";
  }
}

export default {
  meta,
  bootstrap,
  teardown
};
