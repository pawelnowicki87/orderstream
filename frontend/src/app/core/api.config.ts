const isLocalDev = window.location.port === '4200';

// In development the Angular dev server runs on 4200 and the backend on 8080/8084.
// In production everything is served from one origin behind a reverse proxy.
export const API_BASE_URL = isLocalDev ? 'http://localhost:8080' : '';

export const WS_URL = isLocalDev
  ? 'ws://localhost:8084/ws'
  : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
