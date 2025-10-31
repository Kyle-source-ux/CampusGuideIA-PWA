// Service Worker pour CampusGuide iOS PWA
// Version: 2.3.4
// Optimisé pour iOS Safari

const CACHE_NAME = 'campusguide-ios-v2.3.4';
const RUNTIME_CACHE = 'campusguide-runtime';
const IMAGE_CACHE = 'campusguide-images';

// Ressources essentielles à mettre en cache
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
];

// Installation - mise en cache des ressources essentielles
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pré-cache des ressources essentielles');
      return cache.addAll(PRECACHE_URLS);
    }).then(() => {
      // Force l'activation immédiate
      return self.skipWaiting();
    })
  );
});

// Activation - nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== RUNTIME_CACHE && 
              cacheName !== IMAGE_CACHE) {
            console.log('[SW] Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Prend le contrôle de toutes les pages immédiatement
      return self.clients.claim();
    })
  );
});

// Fetch - stratégie de mise en cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    return;
  }

  // Ignorer les requêtes vers APIs externes (Supabase, Cloudinary, Google)
  if (url.hostname.includes('supabase.co') || 
      url.hostname.includes('cloudinary.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('google.com')) {
    return;
  }

  // Stratégie Cache First pour les images
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request).then((response) => {
            // Ne mettre en cache que les réponses réussies
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // Stratégie Network First pour le HTML (toujours la dernière version)
  if (request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Mettre en cache la réponse pour offline
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, response.clone());
          });
          return response;
        })
        .catch(() => {
          // Si offline, utiliser le cache
          return caches.match(request);
        })
    );
    return;
  }

  // Stratégie Cache First pour les autres ressources (CSS, JS, fonts)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Retourner depuis le cache
        return cachedResponse;
      }
      
      // Sinon, aller chercher sur le réseau
      return fetch(request).then((response) => {
        // Ne pas mettre en cache les erreurs
        if (!response || response.status !== 200 || response.type === 'error') {
          return response;
        }

        // Cloner la réponse car elle peut être consommée qu'une fois
        const responseToCache = response.clone();

        caches.open(RUNTIME_CACHE).then((cache) => {
          cache.put(request, responseToCache);
        });

        return response;
      });
    })
  );
});

// Gestion des messages du client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      }).then(() => {
        return self.clients.matchAll();
      }).then((clients) => {
        clients.forEach(client => client.postMessage({
          type: 'CACHE_CLEARED'
        }));
      })
    );
  }
});

// Gestion des notifications push (pour le futur)
self.addEventListener('push', (event) => {
  console.log('[SW] Push reçu:', event);
  const options = {
    body: event.data ? event.data.text() : 'Nouvelle notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Voir',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Fermer',
        icon: '/icon-192.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('CampusGuide', options)
  );
});

// Gestion des clics sur les notifications
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification cliquée:', event);
  event.notification.close();

  event.waitUntil(
    clients.openWindow('/')
  );
});

console.log('[SW] Service Worker CampusGuide iOS chargé');
