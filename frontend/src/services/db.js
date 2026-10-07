/**
 * IndexedDB Data Layer for MPLADS Offline-First Field Verification
 * Database Name: mplads_offline_db
 * Stores:
 *   - projects: Cached compact project dossiers for offline field use
 *   - verification_records: Audit log of locally saved and synced verifications
 *   - sync_queue: Pending operations to be synced when internet connectivity is active
 */

const DB_NAME = 'mplads_offline_db';
const DB_VERSION = 1;

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // 1. Store: projects (key: work_id)
      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'work_id' });
        projectStore.createIndex('by_district', 'district', { unique: false });
        projectStore.createIndex('by_risk_level', 'risk_level', { unique: false });
      }

      // 2. Store: verification_records (key: operation_id)
      if (!db.objectStoreNames.contains('verification_records')) {
        const verStore = db.createObjectStore('verification_records', { keyPath: 'operation_id' });
        verStore.createIndex('by_project_id', 'project_id', { unique: false });
        verStore.createIndex('by_created_at', 'created_at', { unique: false });
        verStore.createIndex('by_sync_status', 'sync_status', { unique: false });
      }

      // 3. Store: sync_queue (key: operation_id)
      if (!db.objectStoreNames.contains('sync_queue')) {
        const queueStore = db.createObjectStore('sync_queue', { keyPath: 'operation_id' });
        queueStore.createIndex('by_status', 'status', { unique: false });
        queueStore.createIndex('by_created_at', 'created_at', { unique: false });
        queueStore.createIndex('by_project_id', 'project_id', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      reject(request.error);
    };
  });

  return dbPromise;
}

// ----------------- Projects Store Operations -----------------

export async function saveProjects(projectsList) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite');
    const store = tx.objectStore('projects');

    projectsList.forEach((proj) => {
      if (proj && proj.work_id) {
        store.put({
          ...proj,
          cached_at: new Date().toISOString()
        });
      }
    });

    tx.oncomplete = () => resolve(projectsList.length);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllCachedProjects() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readonly');
    const store = tx.objectStore('projects');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedProject(workId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readonly');
    const store = tx.objectStore('projects');
    const request = store.get(workId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function updateCachedProject(workId, updates) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readwrite');
    const store = tx.objectStore('projects');
    const getReq = store.get(workId);

    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (existing) {
        const merged = { ...existing, ...updates, updated_at: new Date().toISOString() };
        store.put(merged);
        resolve(merged);
      } else {
        resolve(null);
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// ----------------- Sync Queue Operations -----------------

export async function enqueueOperation(operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const item = {
      operation_id: operation.operation_id,
      device_id: operation.device_id || 'browser-field-device',
      user_id: operation.user_id || 'FIELD_OFFICER_01',
      project_id: operation.project_id,
      operation_type: operation.operation_type || 'FIELD_VERIFICATION',
      payload: operation.payload,
      created_at: operation.created_at || new Date().toISOString(),
      status: operation.status || 'pending', // 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict'
      retry_count: operation.retry_count || 0,
      last_error: operation.last_error || null
    };

    store.put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllQueueItems() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readonly');
    const store = tx.objectStore('sync_queue');
    const request = store.getAll();

    request.onsuccess = () => {
      const items = request.result || [];
      // Return sorted by creation date descending
      items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateQueueItem(operationId, patch) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('sync_queue', 'readwrite');
    const store = tx.objectStore('sync_queue');
    const getReq = store.get(operationId);

    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (existing) {
        const updated = { ...existing, ...patch };
        store.put(updated);
        resolve(updated);
      } else {
        resolve(null);
      }
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

// ----------------- Verification Records Store -----------------

export async function saveLocalVerificationRecord(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('verification_records', 'readwrite');
    const store = tx.objectStore('verification_records');
    store.put(record);

    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalVerificationsForProject(projectId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('verification_records', 'readonly');
    const store = tx.objectStore('verification_records');
    const index = store.index('by_project_id');
    const request = index.getAll(projectId);

    request.onsuccess = () => {
      const list = request.result || [];
      list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}
