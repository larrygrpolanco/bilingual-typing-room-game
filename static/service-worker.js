// Service Worker for Bilingual Typing Room Game

const CACHE_NAME = 'room-maker-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/level1',
  '/level2',
  '/gallery',
  '/fonts/王漢宗中明體注音.ttf'
];

// Install event - cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return the response from cache
        if (response) {
          return response;
        }
        
        // Clone the request since it can only be used once
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest)
          .then(response => {
            // Check if the response is valid
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clone the response since it can only be used once
            const responseToCache = response.clone();
            
            // Cache all images and static assets automatically
            if (event.request.url.includes('/images/') || 
                event.request.url.includes('/items/') ||
                event.request.url.includes('/fonts/') ||
                event.request.url.endsWith('.css') ||
                event.request.url.endsWith('.js')) {
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }
            
            return response;
          });
      })
  );
});