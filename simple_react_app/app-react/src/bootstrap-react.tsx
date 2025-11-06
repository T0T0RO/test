// File: simple_react_app/app-react/src/bootstrap-react.tsx
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import App from './App';

// Metadata exposed for the shell/orchestrator
export const meta = {
  name: 'app-react',
  framework: 'react',
  version: (import.meta as any).env?.VITE_MFE_VERSION || (import.meta as any).env?.VITE_APP_VERSION || '0.0.0'
};

let rootInstance: Root | null = null;
let mountContainer: HTMLElement | null = null;

/**
 * Mount the React app into a DOM element.
 * - container: HTML element where the app will be mounted.
 * - props: optional props passed into root App.
 *
 * Idempotent per-container: repeated calls for the same container are no-ops.
 */
export async function mount(container: HTMLElement, props: Record<string, any> = {}): Promise<{ instance?: any } | void> {
  if (!container) throw new Error('mount: container HTMLElement is required');

  // If already mounted into the same container, do nothing (idempotent)
  if (mountContainer === container && rootInstance) {
    return { instance: rootInstance };
  }

  // Create a wrapper node to avoid clobbering container innerHTML if desired
  // But many apps mount directly to the container — we mount directly for simplicity
  try {
    rootInstance = createRoot(container);
    // Render with props spread to App
    rootInstance.render(React.createElement(App, { ...props }));
    mountContainer = container;
    return { instance: rootInstance };
  } catch (err) {
    // If render fails, ensure no inconsistent state
    if (rootInstance) {
      try { rootInstance.unmount(); } catch { /* ignore */ }
    }
    rootInstance = null;
    mountContainer = null;
    throw err;
  }
}

/**
 * Unmount the React app from the provided container.
 * - If the container does not match the mounted one, this is a safe no-op.
 */
export async function unmount(container: HTMLElement): Promise<void> {
  if (!container) throw new Error('unmount: container HTMLElement is required');

  // Only unmount if this module mounted into the same container
  if (!mountContainer || mountContainer !== container) {
    // nothing to do
    return;
  }

  try {
    rootInstance?.unmount();
  } catch (err) {
    // best-effort cleanup
    // eslint-disable-next-line no-console
    console.warn('react bootstrap: unmount threw', err);
  } finally {
    rootInstance = null;
    mountContainer = null;
    // clean children as a last resort
    container.innerHTML = '';
  }
}

// default export is optional but convenient when importing the entire module
export default {
  meta,
  mount,
  unmount
};
