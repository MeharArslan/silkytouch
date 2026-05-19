// Silky Touch - Service Worker v4
// Handles offline caching for full PWA support

var CACHE = 'silkytouch-v4';

// Install: cache the app
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      console.log('SW: Caching app...');
      return cache.addAll([
        '/',
        '/index.html'
      ]).catch(function(err) {
        console.log('SW: Cache add failed:', err);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch: serve from cache when offline
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  
  var url = e.request.url;
  
  // Skip Firebase/external requests
  if (url.includes('firestore.googleapis.com') || 
      url.includes('firebase') || 
      url.includes('gstatic.com') ||
      url.includes('googleapis.com')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      // Try network first, fall back to cache
      var networkFetch = fetch(e.request).then(function(response) {
        if (response && response.status === 200 && response.type !== 'opaque') {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Offline - serve from cache
        return cached || new Response(
          '<html><body style="background:#0f172a;color:white;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">' +
          '<div><div style="font-size:48px;margin-bottom:16px">📱</div>' +
          '<h2 style="margin:0 0 8px">You are offline</h2>' +
          '<p style="color:#94a3b8;margin:0">Your data is safely stored on device.<br>Connect to internet to sync with cloud.</p></div></body></html>',
          { headers: { 'Content-Type': 'text/html' } }
        );
      });
      
      return cached || networkFetch;
    })
  );
});

// Push notifications
self.addEventListener('push', function(e) {
  var data = { title: 'Silky Touch', body: '' };
  try { data = e.data.json(); } catch(x) { if(e.data) data.body = e.data.text(); }
  
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'silkytouch-' + Date.now(),
      vibrate: [200, 100, 200],
      requireInteraction: false
    })
  );
});

// Notification click
self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(cs) {
      for (var i = 0; i < cs.length; i++) {
        if (cs[i].focus) return cs[i].focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
