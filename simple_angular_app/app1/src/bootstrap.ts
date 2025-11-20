// simple_angular_app/app1/src/bootstrap.ts
// Angular 20 standalone MFE bootstrap for app1
// Used ONLY by the MF2 integration-layer bundler (dist/_mf2/bootstrap.mjs -> remoteEntry.js)
//
// MF2 invariants:
// - The shell passes an HTMLElement container to bootstrap(container).
// - We create <app-root> INSIDE that container (so Angular doesn't touch document.body).
// - We call Angular's normal bootstrapApplication(App, appConfig) so Router + providers
//   behave exactly as in a standard Angular CLI app.
// - teardown(container) destroys the Angular app and removes our wrapper.

import 'zone.js';
import '@angular/compiler';

import { bootstrapApplication } from '@angular/platform-browser';
import type { ApplicationRef } from '@angular/core';

import { App } from './app/app';
import { appConfig } from './app/app.config';

let appRef: ApplicationRef | null = null;
let hostWrapper: HTMLElement | null = null;

/**
 * MF2 entrypoint: bootstrap(container)
 * - container: HTMLElement provided by the shell.
 * - We create a wrapper + <app-root> inside that container.
 * - Then we call bootstrapApplication(App, appConfig).
 *   Angular finds <app-root> and mounts there, with full router behavior.
 */
export async function bootstrap(container: HTMLElement) {
  if (!container) {
    throw new Error('[app1] bootstrap: container is required');
  }

  // If something is already mounted, clean it up first.
  if (hostWrapper && hostWrapper.parentElement) {
    await teardown(container);
  }

  // 1) Create a wrapper inside the MF2 container.
  hostWrapper = document.createElement('div');
  hostWrapper.className = 'mfe-angular-host app1-host';

  // 2) Create the <app-root> host element expected by App.selector.
  const appRoot = document.createElement('app-root');
  hostWrapper.appendChild(appRoot);

  // 3) Attach wrapper into the shell container.
  container.appendChild(hostWrapper);

  // 4) Bootstrap Angular in the NORMAL way.
  //    - Uses appConfig (provideRouter, etc.).
  //    - Triggers router initial navigation.
  appRef = await bootstrapApplication(App, appConfig);

  console.log('[app1] Angular MFE bootstrapped.');

  return { appRef };
}

/**
 * MF2 entrypoint: teardown(container)
 * - Destroys the Angular application instance.
 * - Removes our wrapper from the shell's container.
 */
export async function teardown(container: HTMLElement) {
  if (!container) {
    throw new Error('[app1] teardown: container is required');
  }

  try {
    if (appRef) {
      try {
        appRef.destroy();
      } catch {
        // ignore any destroy-time errors
      }
    }
  } finally {
    if (hostWrapper && container.contains(hostWrapper)) {
      try {
        container.removeChild(hostWrapper);
      } catch {
        // ignore
      }
    }

    appRef = null;
    hostWrapper = null;

    console.log('[app1] Angular MFE torn down.');
  }
}
