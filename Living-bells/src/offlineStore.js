const DB_NAME = 'living-bells-offline'
const DB_VERSION = 2

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('auth')) db.createObjectStore('auth', { keyPath: 'email' })
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function tx(store, mode, work) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(store, mode)
    const objectStore = transaction.objectStore(store)
    let result
    try { result = work(objectStore) } catch (error) { reject(error); return }
    transaction.oncomplete = () => resolve(result)
    transaction.onerror = () => reject(transaction.error)
  }))
}

export async function enqueueRequest(item) {
  const id = item.id || crypto.randomUUID()
  await tx('queue', 'readwrite', store => store.put({ ...item, id, createdAt: item.createdAt || Date.now() }))
  return id
}

export function getQueue() {
  return tx('queue', 'readonly', store => new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  }))
}

export function removeQueuedRequest(id) {
  return tx('queue', 'readwrite', store => store.delete(id))
}

export async function cacheResponse(key, data) {
  await tx('cache', 'readwrite', store => store.put({ key, data, cachedAt: Date.now() }))
}

export function getCachedResponse(key) {
  return tx('cache', 'readonly', store => new Promise((resolve, reject) => {
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result?.data ?? null)
    request.onerror = () => reject(request.error)
  }))
}

export async function queueCount() {
  try { return (await getQueue()).length } catch { return 0 }
}
