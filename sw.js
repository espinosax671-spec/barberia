// SERVICE WORKER — CITABARBER PWA
const APP_VERSION = 'v20250122-1000';
const CACHE_NAME = `citabarber-${APP_VERSION}`;
const CACHE_STATIC = `citabarber-static-${APP_VERSION}`;
const CACHE_IMAGES = `citabarber-images-${APP_VERSION}`;

const STATIC_ASSETS = [
  '/iconos/icon-192.png',
  '/iconos/icon-512.png',
  '/manifest.json'
];

const NETWORK_ONLY_DOMAINS = ['supabase.co', 'supabase.in'];
const FONT_DOMAINS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  console.log(`[SW ${APP_VERSION}] Instalando...`);
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.error('[SW] Error:', err))
  );
});

self.addEventListener('activate', event => {
  console.log(`[SW ${APP_VERSION}] Activando...`);
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names
          .filter(name => name !== CACHE_NAME && name !== CACHE_STATIC && name !== CACHE_IMAGES)
          .map(name => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  const isNetworkOnly = NETWORK_ONLY_DOMAINS.some(domain => url.hostname.includes(domain));
  if (isNetworkOnly) return;

  const isFont = FONT_DOMAINS.some(domain => url.hostname.includes(domain));
  if (isFont) {
    event.respondWith(cacheFirst(event.request, CACHE_STATIC));
    return;
  }

  if (isImage(url.pathname) || url.hostname.includes('supabase.co')) {
    event.respondWith(cacheFirst(event.request, CACHE_IMAGES));
    return;
  }

  event.respondWith(networkFirst(event.request));
});

function isImage(pathname) {
  return /\.(png|jpg|jpeg|gif|svg|webp|ico)$/i.test(pathname);
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response('Recurso no disponible offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;

  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate' || request.destination === 'document') {
      const fallback = await caches.match('/login.html');
      if (fallback) return fallback;

      return new Response(getOfflineHTML(), {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    return new Response('Sin conexión', { status: 503 });
  }
}

function getOfflineHTML() {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sin conexión — CitaBarber</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Inter', -apple-system, sans-serif;
          background: #16294f;
          color: #ffffff;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px;
        }
        .container { max-width: 360px; }
        h1 {
          font-family: 'Oswald', sans-serif;
          font-size: 1.8rem;
          letter-spacing: 0.15em;
          margin-bottom: 12px;
        }
        p { color: #cdd6ea; font-size: 0.95rem; line-height: 1.6; margin-bottom: 28px; }
        button {
          padding: 14px 36px;
          background: #c8202f;
          color: #ffffff;
          border: none;
          border-radius: 4px;
          font-size: 0.85rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          font-weight: 600;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Sin Conexión</h1>
        <p>No hay conexión a internet. Verifica tu red e intenta nuevamente.</p>
        <button onclick="location.reload()">Reintentar</button>
      </div>
    </body>
    </html>
  `;
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
