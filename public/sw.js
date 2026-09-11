const CACHE_NAME = 'lifeos-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache API calls or auth
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/functions/')) {
    return;
  }

  // App shell: cache-first with network fallback
  if (req.mode === 'navigate' || url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        }).catch(() => cached || caches.match('/index.html'));
        return cached || fetchPromise;
      })
    );
  }
});

// Push notification handler
self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Life OS', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Life OS';
  const options = {
    body: payload.body || payload.message || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: payload.tag || payload.id || 'lifeos',
    data: payload.data || {},
    requireInteraction: payload.requireInteraction || false,
  vibrate: payload.vibrate || [50, 30, 50],
  actions: payload.actions || [],
  silent: payload.silent || false,
  renotify: !!payload.tag,
  data: {
    ...payload.data,
    url: payload.url || '/',
  },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || '/';

  // Handle action buttons
  if (event.action && data.actions) {
    const action = data.actions.find((a) => a.action === event.action);
    if (action && action.url) {
      event.waitUntil(clients.openWindow(action.url));
      return;
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', data });
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// Badge API support
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_BADGE') {
    if ('setAppBadge' in navigator) {
      navigator.setAppBadge(event.data.count || 0).catch(() => {});
    }
  } else if (event.data && event.data.type === 'CLEAR_BADGE') {
    if ('clearAppBadge' in navigator) {
      navigator.clearAppBadge().catch(() => {});
    }
  }
});
