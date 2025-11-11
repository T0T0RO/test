import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from './App';

let root: Root | null = null;

export async function bootstrap(container: HTMLElement) {
  if (!container) throw new Error('No container provided to bootstrap React app.');
  root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

export async function teardown() {
  if (root) {
    root.unmount();
    root = null;
  }
}
