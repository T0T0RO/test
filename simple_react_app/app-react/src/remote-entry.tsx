// simple_react_app/app-react/src/remote-entry.tsx
import React from "react";
import { createRoot, Root } from "react-dom/client";
import App from "./App";

export const meta = {
  name: "app-react",
  framework: "react",
  version: (import.meta as any).env?.VITE_MFE_VERSION || (import.meta as any).env?.VITE_APP_VERSION || "0.0.0",
};

let rootInstance: Root | null = null;
let mountedContainer: HTMLElement | null = null;

export async function mount(container: HTMLElement, props: Record<string, any> = {}): Promise<{ instance?: any } | void> {
  if (!container) throw new Error("mount: container HTMLElement is required");

  // idempotent: if already mounted into the same container, do nothing
  if (mountedContainer === container && rootInstance) {
    return { instance: rootInstance };
  }

  try {
    // ensure container is empty-ish (safe mount)
    // Do not clobber if user wants to preserve children - this is conservative
    container.innerHTML = "";

    rootInstance = createRoot(container);
    rootInstance.render(React.createElement(App, { ...props }));
    mountedContainer = container;
    return { instance: rootInstance };
  } catch (err) {
    // cleanup on failure
    try {
      rootInstance?.unmount();
    } catch {}
    rootInstance = null;
    mountedContainer = null;
    throw err;
  }
}

export async function unmount(container: HTMLElement): Promise<void> {
  if (!container) throw new Error("unmount: container HTMLElement is required");

  if (!mountedContainer || mountedContainer !== container) {
    return;
  }

  try {
    rootInstance?.unmount();
  } catch (err) {
    // best-effort
    console.warn("react remote: unmount error", err);
  } finally {
    rootInstance = null;
    mountedContainer = null;
    container.innerHTML = "";
  }
}

export default { meta, mount, unmount };
