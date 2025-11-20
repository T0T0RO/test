/**
 * MF2 build entry for Angular remote (app2).
 *
 * Used only in the MF2 build configuration so that Angular compiles
 * the application's code and assets without bootstrapping it into
 * document. The actual runtime bootstrap is done by src/bootstrap.ts
 * via dist/_mf2/bootstrap.mjs (MF2 integration layer).
 */

import './app/app';
import './app/app.config';
import './app/app.routes';

export {};
