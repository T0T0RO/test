// simple_angular_app/app2/src/bootstrap.ts
// Angular 20 standalone MFE bootstrap for app2
// Used ONLY by the MF2 integration-layer bundler (dist/_mf2/bootstrap.mjs -> remoteEntry.js)

import 'zone.js';
import '@angular/compiler';

import { bootstrapApplication } from '@angular/platform-browser';
import type { ApplicationRef } from '@angular/core';

import { App } from './app/app';
import { appConfig } from './app/app.config';

let appRef: ApplicationRef | null = null;
let hostWrapper: HTMLElement | null = null;

export async function bootstrap(container: HTMLElement) {
  if (!container) {
    throw new Error('[app2] bootstrap: container is required');
  }

  if (hostWrapper && hostWrapper.parentElement) {
    await teardown(container);
  }

  hostWrapper = document.createElement('div');
  hostWrapper.className = 'mfe-angular-host app2-host';

  const appRoot = document.createElement('app-root');
  hostWrapper.appendChild(appRoot);

  container.appendChild(hostWrapper);

  appRef = await bootstrapApplication(App, appConfig);

  console.log('[app2] Angular MFE bootstrapped.');

  return { appRef };
}

export async function teardown(container: HTMLElement) {
  if (!container) {
    throw new Error('[app2] teardown: container is required');
  }

  try {
    if (appRef) {
      try {
        appRef.destroy();
      } catch {
        // ignore
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

    console.log('[app2] Angular MFE torn down.');
  }
}
