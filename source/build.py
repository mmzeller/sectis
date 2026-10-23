#!/usr/bin/env python3
"""Builds Sectis into two outputs:
   dist/web/       — installable offline web app (GitHub Pages, any web host, or a thumb drive)
   dist/artifact/  — single self-contained page for a quick preview
"""
import json, pathlib, re, shutil, subprocess

ROOT = pathlib.Path(__file__).parent
SRC = ROOT / 'src'
DIST = ROOT / 'dist'
VERSION = re.search(r"APP_VERSION = '([^']+)'", (SRC / 'js/01-util.js').read_text()).group(1)

css = (SRC / 'app.css').read_text()
shell = (SRC / 'shell.html').read_text()
js_parts = [p.read_text() for p in sorted((SRC / 'js').glob('*.js'))]

def bundle(web: bool) -> str:
    body = '\n'.join(js_parts)
    if not web:
        body = re.sub(r'/\*WEB-ONLY\*/.*?/\*END-WEB-ONLY\*/', 'function downloadText() { return false; }', body, flags=re.S)
    return f"(function () {{\n'use strict';\nconst SECTIS_WEB = {'true' if web else 'false'};\n{body}\n}})();\n"

def write(path: pathlib.Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)

shutil.rmtree(DIST, ignore_errors=True)

# ---------- web app ----------
web_js = bundle(True)
head = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Sectis</title>
<meta name="description" content="Sectis, a private to-do app: Inbox, Today, Upcoming, projects, areas, tags, checklists and repeating to-dos. Works offline.">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#17191e" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Sectis">
<meta name="application-name" content="Sectis">
<meta name="format-detection" content="telephone=no">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/favicon.svg" type="image/svg+xml">
<link rel="icon" href="icons/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<style>
:root {{ padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); color-scheme: light; }}
{css}
</style>
</head>
<body>
"""
write(DIST / 'web/index.html', head + shell + f"<script>\n{web_js}</script>\n</body>\n</html>\n")

manifest = {
    "name": "Sectis", "short_name": "Sectis", "description": "A private, offline to-do app.",
    "id": "./", "start_url": "./", "scope": "./", "display": "standalone",
    "background_color": "#ffffff", "theme_color": "#ffffff",
    "icons": [
        {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
        {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
        {"src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
    ],
}
write(DIST / 'web/manifest.webmanifest', json.dumps(manifest, indent=2) + '\n')

sw = f"""/* Sectis service worker: keeps the app working offline. */
const CACHE = 'sectis-{VERSION}';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icons/favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => {{
  // cache: 'reload' skips the browser's own cache so an update never installs stale files
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, {{ cache: 'reload' }})))).then(() => self.skipWaiting()));
}});
self.addEventListener('activate', (e) => {{
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
}});
self.addEventListener('fetch', (e) => {{
  const req = e.request;
  if (req.method === 'GET' && req.url.startsWith('https://www.gstatic.com/firebasejs/')) {{
    // the sync library: keep a copy so Sectis can start offline with sync turned on
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {{ const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }})));
    return;
  }}
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (new URL(req.url).pathname.endsWith('/version.json')) return; // always ask the network
  if (req.mode === 'navigate') {{
    // Fresh copy when online (so updates arrive), cached copy when offline.
    e.respondWith(fetch(req.url, {{ cache: 'no-cache', credentials: 'same-origin' }}).then((res) => {{ const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); return res; }}).catch(() => caches.match('./index.html')));
    return;
  }}
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {{ const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; }})));
}});
self.addEventListener('notificationclick', (e) => {{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({{ type: 'window' }}).then((cs) => (cs.length ? cs[0].focus() : self.clients.openWindow('./'))));
}});
"""
write(DIST / 'web/sw.js', sw)
write(DIST / 'web/version.json', json.dumps({'version': VERSION}) + '\n')

icons = DIST / 'web/icons'
icons.mkdir(parents=True, exist_ok=True)
shutil.copy(SRC / 'icon.svg', icons / 'favicon.svg')
render = """
const sharp = require('/opt/npm-tools/node_modules/sharp');
const [src, mask, out] = process.argv.slice(1);
(async () => {
  await sharp(src, { density: 300 }).resize(192, 192).png().toFile(out + '/icon-192.png');
  await sharp(src, { density: 300 }).resize(512, 512).png().toFile(out + '/icon-512.png');
  await sharp(mask, { density: 300 }).resize(512, 512).png().toFile(out + '/icon-maskable-512.png');
  await sharp(mask, { density: 300 }).resize(180, 180).png().toFile(out + '/apple-touch-icon.png');
})();
"""
subprocess.run(['node', '-e', render, str(SRC / 'icon.svg'), str(SRC / 'icon-maskable.svg'), str(icons)], check=True)

shutil.copy(ROOT / 'README.md', DIST / 'web/README.md')

# ---------- single-page preview ----------
art_js = bundle(False)
artifact = f"""<title>Sectis</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
{css}
</style>
{shell}<script>
{art_js}</script>
"""
write(DIST / 'artifact/sectis.html', artifact)

write(DIST / 'bundle-check.js', web_js)
print('built', VERSION, 'web', (DIST / 'web/index.html').stat().st_size, 'bytes; artifact', (DIST / 'artifact/sectis.html').stat().st_size, 'bytes')
