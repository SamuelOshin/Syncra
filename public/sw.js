// ==========================================
// SYNCRA SERVICE WORKER (WEB PUSH)
// ==========================================

self.addEventListener('push', event => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    
    // Choose appropriate icon/badge based on type
    let icon = '/auth_showcase.png'; // fallback
    let badge = '/auth_showcase.png';

    const options = {
      body: data.body,
      icon: icon,
      badge: badge,
      vibrate: [100, 50, 100],
      data: {
        clickUrl: data.clickUrl || '/'
      },
      actions: [
        { action: 'open', title: 'Open Syncra' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Syncra Notification', options)
    );
  } catch (err) {
    console.error('[ServiceWorker] Failed to parse push payload:', err);
    // Fallback to text if JSON parsing fails
    event.waitUntil(
      self.registration.showNotification('Syncra Notification', {
        body: event.data.text(),
        data: { clickUrl: '/' }
      })
    );
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  const clickUrl = event.notification.data?.clickUrl || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // If a tab is already open with the same URL, focus it
      for (const client of windowClients) {
        if (client.url === clickUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(clickUrl);
      }
    })
  );
});
