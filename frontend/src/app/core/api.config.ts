import { environment } from '../../environments/environment';

// Development uses the URLs baked into environment.ts; production builds get them
// from environment.prod.ts, which scripts/generate-env.mjs writes from env vars.
// An empty apiBaseUrl means "same origin", which is how the nginx container serves it.
export const API_BASE_URL = environment.apiBaseUrl;

export const WS_URL =
  environment.wsUrl ||
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;
