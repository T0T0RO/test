// simple_angular_app/app3/src/app/app.config.ts
// ApplicationConfig for Angular 18 MF2 remote (app3).
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // Keep this: good DX, supported in Angular 18
    provideZoneChangeDetection({ eventCoalescing: true }),
    // CRITICAL: this wires the router, without it <router-outlet> stays empty
    provideRouter(routes),
  ],
};
