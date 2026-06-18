/* SwoleSammy — offline cache */
const CACHE = 'swolesammy-v11';
const FONT_CACHE = 'swolesammy-fonts-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './quotes.js',
  './program.js',
  './app.js',
  './manifest.webmanifest',
  './icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONT_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Google Fonts: cache-first so typography works offline after first visit
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONT_CACHE).then(async c => {
        const hit = await c.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        c.put(request, res.clone());
        return res;
      }).catch(() => fetch(request))
    );
    return;
  }

  // other cross-origin (e.g. the quotes API): network only, app has its own fallback
  if (url.origin !== location.origin) return;

  // app shell: network-first (updates show immediately), cache fallback offline
  e.respondWith(
    fetch(request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(request, copy));
      }
      return res;
    }).catch(() => caches.match(request).then(hit => hit || caches.match('./index.html')))
  );
});
