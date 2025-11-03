// sw.js - Service Worker for offline functionality

const CACHE_NAME = 'portfolio-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/base.css?v=2.9',
  '/css/theme.css?v=2.0',
  '/css/chat.css?v=2.1',
  '/js/app.js',
  '/js/router.js',
  '/js/palette.js',
  '/js/theme.js',
  '/js/forms.js',
  '/js/toast.js',
  '/js/projects.js',
  '/js/chat.js',
  '/js/detector.js',
  '/js/engine.local.js',
  '/js/engine.rules.js',
  '/assets/favicon.svg',
  '/assets/portrait.jpg',
  '/assets/resume.pdf'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching files');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          // Cache the response for future use
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        });
      })
  );
});

