const DB_NAME = 'living-bells-offline'
const DB_VERSION = 2

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' })
      if (!db.objectStoreNames.contains('credentials')) db.createObjectStore('credentials', { keyPath: 'email' })
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

export function updateQueuedRequest(id, patch) {
  return tx('queue', 'readwrite', store => new Promise((resolve, reject) => {
    const request = store.get(id)
    request.onsuccess = () => {
      const current = request.result
      if (!current) return resolve(null)
      store.put({ ...current, ...patch })
      resolve({ ...current, ...patch })
    }
    request.onerror = () => reject(request.error)
  }))
}

export function getQueueForOwner(ownerKey) {
  return getQueue().then(queue => queue.filter(item => item.ownerKey === ownerKey))
}

export function queueCountForOwner(ownerKey) {
  return getQueueForOwner(ownerKey).then(items => items.length).catch(() => 0)
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


async function deriveVerifier(password, saltBytes) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: 120000, hash: 'SHA-256' }, material, 256)
  return Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('')
}

function bytesToBase64(bytes) {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary)
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0))
}

export async function saveOfflineIdentity(user, password) {
  if (!user?.email || !password) return
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const verifier = await deriveVerifier(password, salt)
  await tx('credentials', 'readwrite', store => store.put({
    email: String(user.email).trim().toLowerCase(),
    user,
    salt: bytesToBase64(salt),
    verifier,
    updatedAt: Date.now(),
  }))
}

export async function verifyOfflineIdentity(email, password) {
  const normalized = String(email || '').trim().toLowerCase()
  if (!normalized || !password) return null
  const record = await tx('credentials', 'readonly', store => new Promise((resolve, reject) => {
    const request = store.get(normalized)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  }))
  if (!record) return null
  const verifier = await deriveVerifier(password, base64ToBytes(record.salt))
  return verifier === record.verifier ? record.user : null
}
