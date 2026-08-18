/* ==========================================================================
   Fiber UNMS Enterprise — Service Worker (Web Push & System Notifications)
   Supports: Windows Action Center, Android OS, iOS Safari, Desktop Browsers
   ========================================================================== */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {
    title: '🔔 Fiber UNMS Notification',
    body: 'Ada pembaruan status sistem jaringan UNMS.',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    url: '/dashboard',
    type: 'NOC',
  };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/favicon.ico',
    badge: data.badge || '/favicon.ico',
    vibrate: [200, 100, 200, 100, 200], // Pola getar smartphone
    data: {
      url: data.url || '/dashboard',
      dateOfArrival: Date.now(),
    },
    actions: [
      { action: 'open', title: 'Buka Sistem' },
      { action: 'close', title: 'Tutup' },
    ],
    requireInteraction: data.type === 'NOC', // Notifikasi NOC tidak hilang sebelum ditutup (penting untuk insiden)
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
