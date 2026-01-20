const CACHE_NAME = 'task-manager-v58';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/storage.js',
    '/js/config.js',
    '/js/supabase.js',
    '/js/auth.js',
    '/js/sync.js',
    '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Caching app shell');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(function() {
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys()
            .then(function(cacheNames) {
                return Promise.all(
                    cacheNames
                        .filter(function(cacheName) {
                            return cacheName !== CACHE_NAME;
                        })
                        .map(function(cacheName) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(function() {
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', function(event) {
    // Skip caching for Supabase API requests
    if (event.request.url.includes('supabase.co')) {
        event.respondWith(fetch(event.request));
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(function(cachedResponse) {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then(function(response) {
                        // Don't cache non-successful responses or non-GET requests
                        if (!response || response.status !== 200 || event.request.method !== 'GET') {
                            return response;
                        }

                        // Clone the response
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(function(cache) {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(function() {
                        // Return a fallback for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});
