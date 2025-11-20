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
  title = signal('app2');
}
