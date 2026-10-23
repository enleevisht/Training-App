/* PeakPlan v3: Neue Dateien sofort laden, bei Offline-Verbindung aus Cache bedienen. */
const VERSION = 'peakplan-v3.0.0';
const ASSETS = ['./', './index.html', './style.css?v=3', './app.js?v=3', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin)return;
  event.respondWith(fetch(event.request).then(response => {
    if(response.ok){const clone=response.clone();event.waitUntil(caches.open(VERSION).then(cache=>cache.put(event.request,clone)));}
    return response;
  }).catch(async()=>{
    const cached=await caches.match(event.request);
    if(cached)return cached;
    if(event.request.mode==='navigate')return caches.match('./index.html');
    return Response.error();
  }));
});
// Echte zeitgesteuerte Web-Pushs benötigen einen externen Versanddienst.
