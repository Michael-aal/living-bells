import { cacheResponse, getCachedResponse } from './offlineStore'

const AUTH_PREFIX = 'offline-auth::'

export function saveOfflineAuth(record) {
  return cacheResponse(AUTH_PREFIX + record.email, record)
}

export function getOfflineAuth(email) {
  return getCachedResponse(AUTH_PREFIX + String(email || '').trim().toLowerCase())
}

export async function removeOfflineAuth(email) {
  const { deleteCachedResponse } = await import('./offlineStore')
  return deleteCachedResponse(AUTH_PREFIX + String(email || '').trim().toLowerCase())
}
