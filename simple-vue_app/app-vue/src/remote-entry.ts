// simple-vue_app/app-vue/src/remote-entry.ts
import { createApp, App as VueApp } from "vue";
import RootApp from "./App.vue";

export const meta = {
  name: "app-vue",
  framework: "vue",
  version: (import.meta as any).env?.VITE_MFE_VERSION || (import.meta as any).env?.VITE_APP_VERSION || "0.0.0",
};

let vm: VueApp<Element> | null = null;
let mountedContainer: HTMLElement | null = null;

export async function mount(container: HTMLElement, props: Record<string, any> = {}): Promise<{ instance?: any } | void> {
  if (!container) throw new Error("mount: container HTMLElement is required");

  if (mountedContainer === container && vm) {
    return { instance: vm };
  }

  try {
    container.innerHTML = "";
    vm = createApp(RootApp, props);
    vm.mount(container);
    mountedContainer = container;
    return { instance: vm };
  } catch (err) {
    try {
      vm?.unmount();
    } catch {}
    vm = null;
    mountedContainer = null;
    throw err;
  }
}

export async function unmount(container: HTMLElement): Promise<void> {
  if (!container) throw new Error("unmount: container HTMLElement is required");

  if (!mountedContainer || mountedContainer !== container) return;

  try {
    vm?.unmount();
  } catch (err) {
    console.warn("vue remote: unmount error", err);
  } finally {
    vm = null;
    mountedContainer = null;
    container.innerHTML = "";
  }
}

export default { meta, mount, unmount };
