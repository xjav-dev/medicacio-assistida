/* sw.js — Medicació assistida · desa l'app al telèfon perquè s'obri encara que no hi hagi connexió.
   Les crides a l'API no es desen mai. Copyright (c) 2026 xjav-dev · SPDX-License-Identifier: EUPL-1.2 · Versió: 0.9.0 · 2026-11-16 */
var VERSIO_CAU = 'meda-0.9.0';
var FITXERS = ['./', 'index.html', 'app.css', 'config.js', 'comu.js', 'textos-app.js', 'cos.js', 'app.js',
  'manifest.webmanifest', 'icones/icona-192.png', 'icones/apple-touch-icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSIO_CAU).then(function (c) { return c.addAll(FITXERS); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (claus) {
    return Promise.all(claus.filter(function (k) { return k !== VERSIO_CAU; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Primer la xarxa (per tenir sempre la versió nova); si no n'hi ha, la còpia desada.
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.indexOf('panel') > -1) return;
  e.respondWith(fetch(e.request).then(function (r) {
    var copia = r.clone();
    caches.open(VERSIO_CAU).then(function (c) { c.put(e.request, copia); });
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
