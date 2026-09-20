// Local development: the Angular dev server runs on :4200, the gateway on :8080
// and the WebSocket service on :8084. Replaced at build time by environment.prod.ts
// (see angular.json -> configurations.production.fileReplacements).
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080',
  wsUrl: 'ws://localhost:8084/ws',
};
