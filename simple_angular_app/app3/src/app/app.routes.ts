import { Routes } from '@angular/router';
import { Component } from '@angular/core';

@Component({
  standalone: true,
  template: ` <p>Angular remote <strong>app3</strong> works (MF2 mode).</p> `,
})
export class DefaultView {}

export const routes: Routes = [{ path: '', component: DefaultView }];
