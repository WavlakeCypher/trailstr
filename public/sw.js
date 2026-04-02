// TrailStr Service Worker
// Implements caching strategies for offline support and PWA functionality

const CACHE_NAME = 'trailstr-v1'
const STATIC_CACHE = 'trailstr-static-v1'
const DYNAMIC_CACHE = 'trailstr-dynamic-v1'

// Assets to cache immediately (app shell)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  // Add critical CSS and JS files when built
]

// Assets to cache with stale-while-revalidate strategy
const DYNAMIC_ASSETS = [
  // Nostr relay data
  // Map tiles
  // User-generated content
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing')
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('Service Worker: Caching static assets')
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, {
          cache: 'reload'
        })))
      })
      .then(() => {
        console.log('Service Worker: Skip waiting')
        return self.skipWaiting()
      })
      .catch(err => {
        console.error('Service Worker: Install failed', err)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating')
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== STATIC_CACHE && cache !== DYNAMIC_CACHE) {
            console.log('Service Worker: Deleting old cache', cache)
            return caches.delete(cache)
          }
        })
      )
    }).then(() => {
      console.log('Service Worker: Claiming clients')
      return self.clients.claim()
    })
  )
})

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }
  
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return
  }
  
  // Skip nostr relay WebSocket connections
  if (request.headers.get('upgrade') === 'websocket') {
    return
  }

  // Handle different types of requests
  if (isStaticAsset(url)) {
    // Static assets: cache first, then network
    event.respondWith(cacheFirst(request, STATIC_CACHE))
  } else if (isMapTile(url)) {
    // Map tiles: cache first with long expiry
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE, 86400000)) // 24 hours
  } else if (isNostrRelay(url)) {
    // Nostr relay requests: stale while revalidate
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE))
  } else if (isAPIRequest(url)) {
    // API requests: network first, fallback to cache
    event.respondWith(networkFirst(request, DYNAMIC_CACHE))
  } else {
    // Everything else: stale while revalidate
    event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE))
  }
})

// Background sync for publishing events when back online
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event.tag)
  
  if (event.tag === 'publish-events') {
    event.waitUntil(publishPendingEvents())
  }
})

// Push notifications (future enhancement)
self.addEventListener('push', (event) => {
  console.log('Service Worker: Push received', event.data?.text())
  
  const options = {
    body: event.data?.text() || 'New activity from TrailStr',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'trailstr-notification',
    renotify: true
  }
  
  event.waitUntil(
    self.registration.showNotification('TrailStr', options)
  )
})

// Helper functions

function isStaticAsset(url) {
  return url.origin === self.location.origin && (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname === '/' ||
    url.pathname === '/manifest.json'
  )
}

function isMapTile(url) {
  return url.hostname.includes('tile') || 
         url.hostname.includes('openstreetmap') ||
         url.hostname.includes('openfreeMap') ||
         url.pathname.includes('/tiles/')
}

function isNostrRelay(url) {
  // Check for common nostr relay patterns
  return url.protocol === 'https:' && (
    url.hostname.includes('relay') ||
    url.hostname.includes('nostr') ||
    url.pathname.includes('nostr')
  )
}

function isAPIRequest(url) {
  return url.pathname.startsWith('/api/') || 
         url.hostname !== self.location.hostname
}

// Caching strategies

async function cacheFirst(request, cacheName, maxAge = 0) {
  try {
    const cache = await caches.open(cacheName)
    let cachedResponse = await cache.match(request)
    
    // Check if cached response is still valid
    if (cachedResponse && maxAge > 0) {
      const cachedDate = new Date(cachedResponse.headers.get('date') || Date.now())
      const now = new Date()
      if (now.getTime() - cachedDate.getTime() > maxAge) {
        cachedResponse = null
      }
    }
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Fetch from network and cache
    const networkResponse = await fetch(request)
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.error('Cache first strategy failed:', error)
    // Try to return cached version as fallback
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    throw error
  }
}

async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.status === 200) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('Network failed, trying cache:', error)
    const cache = await caches.open(cacheName)
    const cachedResponse = await cache.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    throw error
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cachedResponse = await cache.match(request)
  
  // Start fetch in background to update cache
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.status === 200) {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  }).catch(error => {
    console.log('Background fetch failed:', error)
  })
  
  // Return cached version immediately if available
  if (cachedResponse) {
    // Don't await the fetch promise to return cached response immediately
    fetchPromise.catch(() => {}) // Prevent unhandled rejection
    return cachedResponse
  }
  
  // If no cached version, wait for network
  return fetchPromise
}

// Background sync helpers
async function publishPendingEvents() {
  try {
    // This would integrate with IndexedDB to publish events that failed while offline
    // For now, just log that sync occurred
    console.log('Publishing pending events...')
    
    // In a real implementation, this would:
    // 1. Get pending events from IndexedDB
    // 2. Try to publish them to relays
    // 3. Remove successfully published events from pending queue
    
    return Promise.resolve()
  } catch (error) {
    console.error('Failed to publish pending events:', error)
    throw error
  }
}