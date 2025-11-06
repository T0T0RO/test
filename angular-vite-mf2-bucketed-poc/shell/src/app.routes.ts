import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'app1',
    loadChildren: () =>
      import('app1/RemoteModule').then((m) => m.AppModule),
  },
  {
    path: 'app2',
    loadChildren: () =>
      import('app2/RemoteModule').then((m) => m.AppModule),
  },
  {
    path: 'app3',
    loadChildren: () =>
      import('app3/RemoteModule').then((m) => m.AppModule),
  },
  { path: '**', redirectTo: 'app1' },
];
