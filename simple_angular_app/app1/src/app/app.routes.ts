// app.routes.ts
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
