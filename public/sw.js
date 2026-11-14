/* Zetheta Muster service worker: shows reminder notifications and opens the app on tap. */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: 'Zetheta Muster', body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Zetheta Muster', {
    body: d.body || '', icon: '/logo.png', badge: '/logo.png', data: { url: d.url || '/home' }, tag: d.tag || undefined,
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/home', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(self.location.origin) && 'focus' in c) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
