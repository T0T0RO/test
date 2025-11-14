// MF2 runtime entry for Angular remote app3
// - Shell passes a host container
// - We create <app-root> inside that container
// - We call Angular's bootstrapApplication and keep the ApplicationRef

import 'zone.js';            // keep Zone.js for now (zoneless is optional/experimental)
import '@angular/compiler';

import { bootstrapApplication } from '@angular/platform-browser';
import type { ApplicationRef } from '@angular/core';

import { App } from './app/app';
import { appConfig } from './app/app.config';

let appRef: ApplicationRef | null = null;
let hostWrapper: HTMLElement | null = null;

export async function bootstrap(container: HTMLElement) {
  if (!container) throw new Error('[mfe:app3] bootstrap: container is required');

  // If something is already mounted into this container from a previous run,
  // clean it up first so we can safely re-bootstrap.
  if (hostWrapper?.parentElement) {
    await teardown(container);
  }

  // Create a wrapper and insert <app-root> into the MF2 container
  hostWrapper = document.createElement('div');
  const appRoot = document.createElement('app-root');
  hostWrapper.appendChild(appRoot);
  container.appendChild(hostWrapper);

  // Delegate actual Angular bootstrapping to bootstrapApplication
  appRef = await bootstrapApplication(App, appConfig);

  console.log('[mfe:app3] Angular MFE bootstrapped');

  return { appRef };
}

export async function teardown(container: HTMLElement) {
  if (!container) throw new Error('[mfe:app3] teardown: container is required');

  try {
    if (appRef) {
      appRef.destroy();
    }
  } catch {
    // ignore teardown errors
  }

  try {
    if (hostWrapper && container.contains(hostWrapper)) {
      container.removeChild(hostWrapper);
    }
  } catch {
    // ignore DOM detach errors
  }

  appRef = null;
  hostWrapper = null;

  console.log('[mfe:app3] Angular MFE torn down');
}
