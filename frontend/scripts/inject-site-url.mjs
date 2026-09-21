// Link-preview crawlers (LinkedIn, Slack, X) ignore relative og:image URLs, so the
// absolute site URL is written into the built index.html after `ng build`.
//
// Uses SITE_URL if set, otherwise Vercel's VERCEL_PROJECT_PRODUCTION_URL system variable.
// Without either (local and Docker builds) the placeholder becomes an empty string,
// leaving same-origin paths, which is harmless.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const indexFile = resolve(here, '../dist/frontend/browser/index.html');

const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const siteUrl = (process.env.SITE_URL ?? (vercelHost ? `https://${vercelHost}` : '')).replace(/\/$/, '');

const html = readFileSync(indexFile, 'utf8').replaceAll('__SITE_URL__', siteUrl);
writeFileSync(indexFile, html, 'utf8');

console.log(`[inject-site-url] og:image base = ${siteUrl || '(same origin)'}`);
