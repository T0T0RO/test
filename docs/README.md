# MF2 Microfrontend Platform

Multi-framework microfrontend platform using **MF2 (Micro Frontend Federation v2)** with:

- Angular 18 and 20 (both standalone)
- React
- Vue
- Vite Vanilla
- Framework-agnostic Vite shell
- Integration layer that orchestrates builds and manifest generation

Everything is wired so that the shell only talks to **built artifacts in `dist`**, never to a remote’s `src` files.

---

## 1. Repository Overview

High-level layout (paths are relative to repo root):

```text
integration-layer/
  remote-configs/mfe.config.json    # Single source of truth (SSOT) for all remotes
  scripts/
    build-remotes.mjs               # Build all remotes
    generate-remote-entry.mjs       # Bundle bootstrap -> dist/_mf2/bootstrap.mjs + remoteEntry.js
    generate-remote-manifest.mjs    # Build remote-manifest.js from remoteEntry.js files
  dist/
    remote-manifest.js              # Generated, then copied into shell
  shell/
    vite.config.ts                  # Shell Vite config (aliases /remotes/* to dist/)
    src/
      remote-manifest.js            # Copy of dist/manifest, used at runtime (do not edit)
      runtime/remoteLoader.ts       # Dynamic loader + mount/unmount orchestration
      main.ts                       # Simple UI to switch between remotes

simple_angular_app/
  app1/
  app2/

simple_react_app/app-react/
simple_vue_app/app-vue/
simple_vite_app/app-vite-vanilla/
```

---

## 2. Core Principles

### 2.1 Dist-only consumption

- The shell never imports remote `src/**` files.
- Every remote is consumed via a runtime-loaded `remoteEntry.js` in its `dist` folder.
- Path shape in the browser: `/remotes/<name>/remoteEntry.js`.

### 2.2 Single source of truth (SSOT)

All remote configuration lives in:

```text
integration-layer/remote-configs/mfe.config.json
```

Each entry describes one remote:

```jsonc
{
  "name": "app1",
  "framework": "angular",
  "root": "../simple_angular_app/app1",
  "bootstrap": "src/bootstrap.ts",
  "enabled": true
}
```

The integration layer reads this file to:

- know which remotes exist
- know where they live (`root`)
- know what bootstrap file to bundle (`bootstrap`)
- know how to build them (`buildCommand`, if provided)

### 2.3 Unified runtime contract

Every remote is exposed through `dist/remoteEntry.js` which must export:

```ts
export const meta = { name, framework, version };
export async function mount(container: HTMLElement, props?: unknown): Promise<void>;
export async function unmount(container: HTMLElement): Promise<void>;
```

The shell’s runtime (`remoteLoader.ts`) is written only against this contract and does **not** know which framework is behind a remote.

### 2.4 No ts-node or runtime transpilation

- Integration-layer scripts are **ES modules (`*.mjs`)**, executed by Node directly.
- There is no ts-node, no dynamic TypeScript compilation at runtime.
- All bundling is done via esbuild from JavaScript/TypeScript that the apps produce.

### 2.5 Framework isolation

- Each remote bundles its own framework runtime.
- The shell is framework-agnostic and does not share React/Angular/Vue instances with remotes.

---

## 3. Integration Layer

The integration layer is responsible for:

- building remotes (via their own package.json scripts / Angular CLI)
- bundling each remote’s MF2 bootstrap file
- generating a `remoteEntry.js` wrapper that matches the MF2 contract
- generating the runtime manifest and copying it into the shell

### 3.1 Build orchestration: `build-remotes.mjs`

Responsibilities:

- read `mfe.config.json`
- filter `enabled: true` remotes
- compute remote root from `root`
- choose the build command:
  - **Angular**: typically `npm run build:mf2` or CLI-based command
  - **Other frameworks** (React/Vue/Vite): usually `npm run build`
- run the command in the remote’s root

Angular is special because the CLI bootstraps apps by default. For MF2 we need a dedicated build configuration (see section 5.4), so Angular remotes usually define both:

- a **normal build** for team local dev
- an **MF2 build** for integration with this shell

### 3.2 Bootstrap bundling: `generate-remote-entry.mjs`

For each remote in `mfe.config.json`:

1. Takes its `bootstrap` path (e.g., `src/bootstrap.ts` or `src/bootstrap.tsx`).
2. Uses esbuild to bundle it into `dist/_mf2/bootstrap.mjs`.
3. Emits `dist/remoteEntry.js` that:
   - exports `meta`
   - exports `mount(container, props?)`
   - exports `unmount(container)`
   - re-exports these via dynamic `import('./_mf2/bootstrap.mjs')`

This guarantees a **uniform runtime contract** regardless of framework.

### 3.3 Manifest generation: `generate-remote-manifest.mjs`

This script:

- finds each remote’s `dist/remoteEntry.js`
- builds `integration-layer/dist/remote-manifest.js`:

  ```ts
  export const remoteManifest = {
    "app1": {
      entry: "/remotes/app1/remoteEntry.js",
      framework: "angular",
      version: "X",
      status: "available"
    },
    "app-react": {
      entry: "/remotes/app-react/remoteEntry.js",
      framework: "react",
      version: "X",
      status: "available"
    }
  };
  ```

- copies that file into `integration-layer/shell/src/remote-manifest.js`

The shell always loads remotes through this manifest and never hardcodes paths.

---

## 4. Shell Architecture

### 4.1 Vite config (shell)

The shell Vite config must:

- alias `/remotes/<name>/remoteEntry.js` to each remote’s `dist/remoteEntry.js`
- expose remote `dist/**` folders via a static file server
- not allow serving source files from remotes (defense in depth)

The shell itself is just a small Vite app that:

- reads `remoteManifest`
- lists available remotes
- calls `mountRemote(name, container)` and `unmountRemote(name, container)`

### 4.2 Runtime loader

`integration-layer/shell/src/runtime/remoteLoader.ts` is the generic runtime for MF2.

Responsibilities:

- import `{ remoteManifest }` from `remote-manifest.js`
- provide `listAvailableRemotes()` for UI/debug
- dynamically import `/remotes/<name>/remoteEntry.js`
- validate that `mount`/`unmount` exist and are functions
- orchestrate switching between remotes (teardown + mount new one)

The shell’s `main.ts` is a thin wrapper that:

- renders a simple UI with buttons for each remote
- calls into `remoteLoader.ts` to switch remotes

---

## 5. Framework Adapters

### 5.1 React

React remotes use a simple `createRoot`–based bootstrap:

```ts
// src/bootstrap.tsx
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from './App';

let root: Root | null = null;

export async function bootstrap(container: HTMLElement) {
  if (!container) throw new Error('No container provided.');
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
```

This is all the MF2 integration needs from React remotes.

---

### 5.2 Vue

Vue remotes use `createApp` with explicit mount/unmount:

```ts
// src/bootstrap.ts
import { createApp, type App as VueApp } from 'vue';
import App from './App.vue';

let app: VueApp<Element> | null = null;

export async function bootstrap(container: HTMLElement) {
  if (!container) throw new Error('[app-vue] container is required');
  app = createApp(App);
  app.mount(container);
  console.log('[app-vue] mounted into MF2 host');
}

export async function teardown(container: HTMLElement) {
  if (app) {
    app.unmount();
    app = null;
  }
  container.innerHTML = '';
  console.log('[app-vue] unmounted from MF2 host');
}
```

---

### 5.3 Vanilla

A vanilla remote is just DOM manipulation with a clean teardown:

```ts
// src/bootstrap.ts
let currentRoot: HTMLElement | null = null;

export async function bootstrap(container: HTMLElement) {
  if (!container) throw new Error('[app-vanilla] container is required');
  const root = document.createElement('div');
  root.textContent = 'Hello from vanilla remote';
  container.appendChild(root);
  currentRoot = root;
}

export async function teardown(container: HTMLElement) {
  if (currentRoot && container.contains(currentRoot)) {
    container.removeChild(currentRoot);
  }
  currentRoot = null;
}
```

---

### 5.4 Angular 20 (Standalone MF2 Pattern)

Angular requires more setup because:

- the CLI bootstraps applications by default
- we need to avoid global `bootstrapApplication(App, ...)` for MF2
- we want both:
  - a **standard build+serve** for the team (`ng serve`, `ng build`)
  - an **MF2 build** for integration (`ng build --configuration=mf2`)

Angular remotes follow this pattern:

#### 5.4.1 Root component

```ts
// src/app/app.ts
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="mfe-card">
      <h2>Angular Remote: {{ title() }}</h2>
      <router-outlet></router-outlet>
    </div>
  `,
  styles: [`
    .mfe-card {
      padding: 8px;
      border: 1px dashed #888;
      border-radius: 6px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    }
  `]
})
export class App {
  // For app1/app2 this value is overridden per project
  title = signal('app');
}
```

#### 5.4.2 Routes

```ts
// src/app/app.routes.ts
import { Routes } from '@angular/router';
import { Component } from '@angular/core';

@Component({
  standalone: true,
  template: `<p>Angular remote default works</p>`,
})
export class DefaultView {}

export const routes: Routes = [
  { path: '', component: DefaultView },
];
```

#### 5.4.3 Application config

```ts
// src/app/app.config.ts
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
  ],
};
```

#### 5.4.4 MF2 runtime bootstrap

```ts
// src/bootstrap.ts
// Used ONLY by MF2 integration layer -> dist/_mf2/bootstrap.mjs

import 'zone.js';
import '@angular/compiler';

import { createApplication } from '@angular/platform-browser';
import { createComponent, EnvironmentInjector } from '@angular/core';

import { App } from './app/app';
import { appConfig } from './app/app.config';

let appRef: any = null;
let compRef: any = null;
let hostWrapper: HTMLElement | null = null;

export async function bootstrap(container: HTMLElement) {
  if (!container) {
    throw new Error('[app1] bootstrap: container is required');
  }

  hostWrapper = document.createElement('div');
  const appRoot = document.createElement('app-root');
  hostWrapper.appendChild(appRoot);
  container.appendChild(hostWrapper);

  appRef = await createApplication(appConfig);
  const env: EnvironmentInjector = appRef.injector;

  compRef = createComponent(App, {
    environmentInjector: env,
    hostElement: appRoot,
  });

  appRef.attachView(compRef.hostView);
  compRef.changeDetectorRef.detectChanges();

  console.log('[app1] Angular MFE bootstrapped:', compRef.instance);

  return { appRef, compRef };
}

export async function teardown(container: HTMLElement) {
  if (!container) {
    throw new Error('[app1] teardown: container is required');
  }

  try {
    if (compRef?.destroy) {
      try {
        compRef.destroy();
      } catch {
        // ignore
      }
    }

    if (appRef?.destroy) {
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

    compRef = null;
    appRef = null;
    hostWrapper = null;

    console.log('[app1] Angular MFE torn down');
  }
}
```

#### 5.4.5 Angular MF2 build entry

```ts
// src/main.mf2.ts
// Build-only entry for MF2. Does NOT bootstrap the app into document.

import './app/app';
import './app/app.config';
import './app/app.routes';

export {};
```

#### 5.4.6 Angular MF2 index

```html
<!-- src/index.mf2.html -->
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>App1 (MF2 Remote)</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/x-icon" href="favicon.ico" />
  </head>
  <body>
    <!-- MF2 build: bootstrap.ts will be invoked from remoteEntry.js.
         We don't attach <app-root> directly here. -->
  </body>
</html>
```

#### 5.4.7 Angular CLI configuration (angular.json)

Each Angular remote defines a dedicated MF2 build configuration, for example:

```jsonc
{
  "projects": {
    "app1": {
      "architect": {
        "build": {
          "builder": "@angular/build:application",
          "options": {
            "browser": "src/main.ts",
            "polyfills": ["zone.js"],
            "tsConfig": "tsconfig.app.json",
            "assets": [{ "glob": "**/*", "input": "public" }],
            "styles": ["src/styles.css"]
          },
          "configurations": {
            "production": {
              "outputHashing": "all"
            },
            "development": {
              "optimization": false,
              "extractLicenses": false,
              "sourceMap": true
            },
            "mf2": {
              "browser": "src/main.mf2.ts",
              "index": "src/index.mf2.html"
            }
          },
          "defaultConfiguration": "production"
        }
      }
    }
  }
}
```

Team local build/serve:
- `npm start` → `ng serve` using `main.ts` / `index.html`
- `npm run build` → `ng build`

MF2 build (used by integration layer):
- `npm run build:mf2` → `ng build --configuration=mf2`

---

## 6. End-to-End Flow

End-to-end sequence when you run the integration-layer commands:

1. **Build remotes**  
   ```bash
   npm run -C ./integration-layer build:remotes
   ```
2. **Generate bootstrap bundles and remoteEntry.js**  
   ```bash
   npm run -C ./integration-layer gen:entries
   ```
3. **Generate and copy manifest**  
   ```bash
   npm run -C ./integration-layer gen:manifest
   ```
4. **Run shell in dev mode**  
   ```bash
   npm run -C ./integration-layer dev:shell
   ```

There is also a convenience command that does 1–3 in one go:

```bash
npm run -C ./integration-layer refresh:all:build
```

And the dev shell command triggers a lightweight refresh before startup:

```bash
npm run -C ./integration-layer dev:shell
```

Once the shell is up at `http://localhost:5173/` you can:

- switch between remotes with the buttons
- see each framework mounted into the same host element
- watch Angular remotes bootstrapping and tearing down cleanly

---

## 7. Developer Onboarding

To keep this README focused on architecture, the detailed **per-app and per-team workflows** are described in:

- [`docs/developer-onboarding.md`](docs/developer-onboarding.md)

That file is grouped by:
- Integration Layer + Shell team
- Angular remotes (app1, app2)
- React remote (app-react)
- Vue remote (app-vue)
- Vanilla remote (app-vite-vanilla)

Each section explains:
- how to run the app alone
- how to run it as an MF2 remote
- how its bootstrap and build are wired into the integration layer

---

## 8. Summary

This repository provides a multi-framework MF2 setup where:

- all remotes are integrated at the `dist` level
- the shell is framework-agnostic
- each remote exposes a consistent mount/unmount contract
- Angular 20 standalone works cleanly as a remote using a dedicated MF2 build pipeline

See `docs/developer-onboarding.md` for day-to-day developer workflows per app.
