import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

if (!dist.startsWith(root + '\\') && !dist.startsWith(root + '/')) {
  throw new Error('Refusing to build outside the website directory.');
}

const publicFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'experience.js',
  'arcade.js',
  'favicon.svg',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const relativePath of publicFiles) {
  const source = join(root, relativePath);
  if (!existsSync(source)) throw new Error('Missing public file: ' + relativePath);
  const destination = join(dist, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

const threeSource = join(root, 'node_modules', 'three', 'build', 'three.module.min.js');
if (!existsSync(threeSource)) throw new Error('Missing vendored Three.js module. Run npm install first.');
const threeCoreSource = join(root, 'node_modules', 'three', 'build', 'three.core.min.js');
if (!existsSync(threeCoreSource)) throw new Error('Missing vendored Three.js core module. Run npm install first.');
await mkdir(join(dist, 'vendor'), { recursive: true });
await copyFile(threeSource, join(dist, 'vendor', 'three.module.min.js'));
await copyFile(threeCoreSource, join(dist, 'vendor', 'three.core.min.js'));

if (existsSync(join(root, 'og.png'))) {
  await copyFile(join(root, 'og.png'), join(dist, 'og.png'));
}

const index = await readFile(join(root, 'index.html'));
await writeFile(join(dist, '404.html'), index);

const buildInfo = {
  schemaVersion: 1,
  site: 'brokedev.games',
  release: 'playable-world-002',
  generatedAt: new Date().toISOString(),
};
await writeFile(join(dist, 'build-info.json'), JSON.stringify(buildInfo, null, 2) + '\n');

const textAssetNames = [
  'index.html',
  '404.html',
  'styles.css',
  'app.js',
  'experience.js',
  'arcade.js',
  'favicon.svg',
  'vendor/three.module.min.js',
  'vendor/three.core.min.js',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  'build-info.json',
];
const textAssets = {};
for (const assetName of textAssetNames) {
  textAssets['/' + assetName] = await readFile(join(dist, assetName), 'utf8');
}

const binaryAssets = {};
if (existsSync(join(dist, 'og.png'))) {
  binaryAssets['/og.png'] = (await readFile(join(dist, 'og.png'))).toString('base64');
}

const workerSource = [
  'const TEXT_ASSETS = ' + JSON.stringify(textAssets) + ';',
  'const BINARY_ASSETS = ' + JSON.stringify(binaryAssets) + ';',
  'const CONTENT_TYPES = {',
  '  ".html": "text/html; charset=utf-8",',
  '  ".css": "text/css; charset=utf-8",',
  '  ".js": "text/javascript; charset=utf-8",',
  '  ".txt": "text/plain; charset=utf-8",',
  '  ".xml": "application/xml; charset=utf-8",',
  '  ".webmanifest": "application/manifest+json; charset=utf-8",',
  '  ".json": "application/json; charset=utf-8",',
  '  ".png": "image/png",',
  '  ".svg": "image/svg+xml",',
  '};',
  'const SECURITY_HEADERS = {',
  "  \"Content-Security-Policy\": \"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'\",",
  '  "Cross-Origin-Opener-Policy": "same-origin",',
  '  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",',
  '  "Referrer-Policy": "strict-origin-when-cross-origin",',
  '  "X-Content-Type-Options": "nosniff",',
  '  "X-Frame-Options": "DENY",',
  '};',
  'function extension(pathname) {',
  '  const index = pathname.lastIndexOf(".");',
  '  return index >= 0 ? pathname.slice(index) : "";',
  '}',
  'function decodeBase64(value) {',
  '  const binary = atob(value);',
  '  const bytes = new Uint8Array(binary.length);',
  '  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);',
  '  return bytes;',
  '}',
  'function headersFor(pathname, status) {',
  '  const headers = new Headers(SECURITY_HEADERS);',
  '  headers.set("Content-Type", CONTENT_TYPES[extension(pathname)] || "application/octet-stream");',
  '  headers.set("Cache-Control", pathname.endsWith(".html") || status >= 400 ? "no-cache" : "public, max-age=300");',
  '  return headers;',
  '}',
  'export default {',
  '  async fetch(request) {',
  '    if (request.method !== "GET" && request.method !== "HEAD") {',
  '      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });',
  '    }',
  '    const url = new URL(request.url);',
  '    let pathname;',
  '    try { pathname = decodeURIComponent(url.pathname); } catch (_) { pathname = "/404.html"; }',
  '    if (pathname === "/") pathname = "/index.html";',
  '    let body;',
  '    let status = 200;',
  '    if (Object.hasOwn(TEXT_ASSETS, pathname)) body = TEXT_ASSETS[pathname];',
  '    else if (Object.hasOwn(BINARY_ASSETS, pathname)) body = decodeBase64(BINARY_ASSETS[pathname]);',
  '    else { pathname = "/404.html"; body = TEXT_ASSETS[pathname]; status = 404; }',
  '    return new Response(request.method === "HEAD" ? null : body, { status, headers: headersFor(pathname, status) });',
  '  },',
  '};',
].join('\n');

await mkdir(join(dist, 'server'), { recursive: true });
await writeFile(join(dist, 'server', 'index.js'), workerSource);

console.log('Built sanitized public site at ' + dist);
