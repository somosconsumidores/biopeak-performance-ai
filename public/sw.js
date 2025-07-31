const CACHE_NAME = 'biopeak-v2';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// Training session persistence
const TRAINING_SESSION_STORE = 'training-sessions';
const PENDING_SYNC_STORE = 'pending-sync';

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Background sync for training data
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-training') {
    event.waitUntil(syncTrainingData());
  }
});

// Message handling for training session updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TRAINING_UPDATE') {
    handleTrainingUpdate(event.data.payload);
  }
});

// Store training data for background sync
async function handleTrainingUpdate(data) {
  try {
    const db = await openTrainingDB();
    const tx = db.transaction(TRAINING_SESSION_STORE, 'readwrite');
    const store = tx.objectStore(TRAINING_SESSION_STORE);
    
    await store.put({
      id: data.sessionId,
      data: data,
      timestamp: Date.now(),
      synced: false
    });
  } catch (error) {
    console.error('Error storing training data:', error);
  }
}

// Sync training data when connection is restored
async function syncTrainingData() {
  try {
    const db = await openTrainingDB();
    const tx = db.transaction(TRAINING_SESSION_STORE, 'readonly');
    const store = tx.objectStore(TRAINING_SESSION_STORE);
    const unsyncedData = await store.getAll();
    
    for (const item of unsyncedData) {
      if (!item.synced) {
        try {
          // Attempt to sync with server
          await fetch('/api/sync-training-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.data)
          });
          
          // Mark as synced
          const updateTx = db.transaction(TRAINING_SESSION_STORE, 'readwrite');
          const updateStore = updateTx.objectStore(TRAINING_SESSION_STORE);
          item.synced = true;
          await updateStore.put(item);
        } catch (syncError) {
          console.error('Sync failed for item:', item.id, syncError);
        }
      }
    }
  } catch (error) {
    console.error('Background sync error:', error);
  }
}

// IndexedDB setup for training data
function openTrainingDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('BioPeakTraining', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains(TRAINING_SESSION_STORE)) {
        db.createObjectStore(TRAINING_SESSION_STORE, { keyPath: 'id' });
      }
      
      if (!db.objectStoreNames.contains(PENDING_SYNC_STORE)) {
        db.createObjectStore(PENDING_SYNC_STORE, { keyPath: 'id' });
      }
    };
  });
}