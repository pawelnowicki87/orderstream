// Writes src/environments/environment.prod.ts from environment variables so the
// deployed URLs are never committed. Runs before every production build.
//
//   API_BASE_URL  e.g. https://orderstream-gateway.up.railway.app   (no trailing slash)
//   WS_URL        e.g. wss://orderstream-notifications.up.railway.app/ws
//
// Leaving API_BASE_URL empty makes the app use relative paths, which is what you want
// when something in front of it (an nginx container, a reverse proxy) serves the API
// from the same origin.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, '../src/environments/environment.prod.ts');

const apiBaseUrl = (process.env.API_BASE_URL ?? '').replace(/\/$/, '');
const wsUrl = process.env.WS_URL ?? '';

if (!wsUrl) {
  console.warn(
    '[generate-env] WS_URL is not set — live order tracking will fall back to the ' +
      'current origin, which only works when a proxy forwards /ws to notification-service.',
  );
}

const contents = `// GENERATED FILE — do not edit, do not commit.
// Written by scripts/generate-env.mjs from API_BASE_URL and WS_URL at build time.
export const environment = {
  production: true,
  apiBaseUrl: ${JSON.stringify(apiBaseUrl)},
  wsUrl: ${JSON.stringify(wsUrl)},
};
`;

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, contents, 'utf8');

console.log(
  `[generate-env] apiBaseUrl=${apiBaseUrl || '(relative)'} wsUrl=${wsUrl || '(derived from origin)'}`,
);
