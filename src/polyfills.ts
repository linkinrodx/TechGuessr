// Polyfill de `global` para paquetes pensados originalmente para Node.js
// (amazon-cognito-identity-js depende de `buffer`, que asume que `global`
// existe). El navegador no define `global`; se lo hacemos apuntar a
// `globalThis`, que sí existe de forma nativa. Debe cargarse antes que
// cualquier otro módulo de la app (ver angular.json, "polyfills").
(globalThis as unknown as { global: typeof globalThis }).global = globalThis;
