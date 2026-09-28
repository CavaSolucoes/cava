/* Finanças do Casal — Service Worker
   - Guarda só o "casco" do app (HTML, manifest, ícones e a biblioteca supabase-js do CDN).
   - NUNCA intercepta chamadas ao Supabase (dados, auth, realtime): elas vão sempre direto pra rede.
   - Para publicar uma nova versão, basta mudar CACHE_VERSION. */
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'financas-casal-' + CACHE_VERSION;
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './pwa/icon-192.png',
  './pwa/icon-512.png',
  './pwa/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('financas-casal-') && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Supabase (dados, auth, realtime) e qualquer outro domínio: não mexe, vai direto pra rede.
  const isSameOrigin = url.origin === self.location.origin;
  const isSupabaseLib = url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/@supabase/supabase-js');
  if (!isSameOrigin && !isSupabaseLib) return;

  if (isSupabaseLib) {
    // biblioteca versionada: cache primeiro, atualiza em segundo plano
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Arquivos do app: rede primeiro (pega atualização), cache como reserva offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});
