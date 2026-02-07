/**
 * Service Worker for HBM Resonance PWA
 * Handles caching, offline support, and app shell architecture
 * @version 1.0.0
 */

const CACHE_NAME = 'hbm-resonance-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

/**
 * Install event - cache static assets
 * @param {ExtendableEvent} event
 */
self.addEventListener('install', function(event) {
    console.log('[SW] Install event');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('[SW] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(function() {
                console.log('[SW] Static assets cached successfully');
                return self.skipWaiting();
            })
            .catch(function(err) {
                console.error('[SW] Failed to cache static assets:', err);
            })
    );
});

/**
 * Activate event - clean up old caches
 * @param {ExtendableEvent} event
 */
self.addEventListener('activate', function(event) {
    console.log('[SW] Activate event');
    
    event.waitUntil(
        caches.keys()
            .then(function(cacheNames) {
                return Promise.all(
                    cacheNames
                        .filter(function(name) {
                            return name !== CACHE_NAME;
                        })
                        .map(function(name) {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(function() {
                console.log('[SW] Claiming clients');
                return self.clients.claim();
            })
    );
});

/**
 * Fetch event - serve from cache, fallback to network
 * Implements stale-while-revalidate for better performance
 * @param {FetchEvent} event
 */
self.addEventListener('fetch', function(event) {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip cross-origin requests (except Google Fonts)
    if (url.origin !== self.location.origin && !url.hostname.includes('fonts.googleapis.com') && !url.hostname.includes('fonts.gstatic.com')) {
        return;
    }
    
    event.respondWith(
        caches.match(request)
            .then(function(cachedResponse) {
                // Return cached response immediately if available
                if (cachedResponse) {
                    // Revalidate in background for fresh content
                    fetch(request)
                        .then(function(networkResponse) {
                            if (networkResponse && networkResponse.status === 200) {
                                caches.open(CACHE_NAME)
                                    .then(function(cache) {
                                        cache.put(request, networkResponse.clone());
                                    });
                            }
                        })
                        .catch(function() {
                            // Network failed, cached version is already returned
                        });
                    
                    return cachedResponse;
                }
                
                // Not in cache, fetch from network
                return fetch(request)
                    .then(function(networkResponse) {
                        // Don't cache non-successful responses
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        
                        // Cache the response
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then(function(cache) {
                                cache.put(request, responseToCache);
                            });
                        
                        return networkResponse;
                    })
                    .catch(function(error) {
                        console.error('[SW] Fetch failed:', error);
                        
                        // Return offline fallback for HTML requests
                        if (request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }
                        
                        throw error;
                    });
            })
    );
});

/**
 * Message event - handle messages from the main app
 * @param {MessageEvent} event
 */
self.addEventListener('message', function(event) {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
