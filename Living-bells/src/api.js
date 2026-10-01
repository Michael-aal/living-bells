import { enqueueRequest, getQueue, removeQueuedRequest, cacheResponse, getCachedResponse, queueCount } from './offlineStore'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

function authHeaders() {
  const token = localStorage.getItem('living_bells_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function cacheKey(path) {
  const user = localStorage.getItem('living_bells_user') || 'anonymous'
  return `${user}::${BASE + path}`
}

function dispatchSyncState() {
  window.dispatchEvent(new CustomEvent('living-bells-sync'))
}

export async function apiRequest(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase()
  const headers = { 'Content-Type': 'application/json', ...authHeaders(), ...(options.headers || {}) }

  try {
    const response = await fetch(BASE + path, { ...options, method, headers })
    const contentType = response.headers.get('content-type') || ''
    const data = contentType.includes('application/json') ? await response.json().catch(() => ({})) : {}

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('living_bells_token')
        localStorage.removeItem('living_bells_user')
        throw new Error(data.message || 'Your session has expired. Please sign in again.')
      }
      if (response.status === 403) throw new Error(data.message || 'You do not have permission to perform this action.')
      throw new Error(data.message || 'API request failed (' + response.status + ')')
    }

    if (method === 'GET') {
      await cacheResponse(cacheKey(path), data).catch(() => {})
    }
    return data
  } catch (error) {
    const networkFailure = error instanceof TypeError || /Cannot reach|Failed to fetch|NetworkError|Load failed/i.test(error.message || '')
    if (!networkFailure) throw error

    if (method === 'GET') {
      const cached = await getCachedResponse(cacheKey(path)).catch(() => null)
      if (cached !== null) return cached
      throw new Error('Offline and this data has not been cached on this device yet.')
    }

    if (!localStorage.getItem('living_bells_token') || path.startsWith('/api/auth/')) {
      throw new Error('You are offline. Sign in while online before using offline recording.')
    }

    const id = await enqueueRequest({
      path,
      method,
      body: options.body || null,
      headers: { 'Content-Type': 'application/json' },
      clientRequestId: crypto.randomUUID(),
    })
    dispatchSyncState()
    const body = options.body ? JSON.parse(options.body) : {}
    return { ...body, id: `offline-${id}`, offline: true, queued: true }
  }
}

export async function syncOfflineQueue() {
  if (!navigator.onLine) return { synced: 0, pending: await queueCount() }
  const queue = await getQueue().catch(() => [])
  let synced = 0

  for (const item of queue.sort((a, b) => a.createdAt - b.createdAt)) {
    const token = localStorage.getItem('living_bells_token')
    if (!token) break

    try {
      const response = await fetch(BASE + item.path, {
        method: item.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Client-Request-Id': item.clientRequestId || item.id,
        },
        body: item.body || undefined,
      })

      if (response.status === 401) break
      if (response.status >= 500) break

      if (response.ok || response.status === 409) {
        await removeQueuedRequest(item.id)
        synced += 1
      } else {
        await removeQueuedRequest(item.id)
      }
    } catch {
      break
    }
  }

  dispatchSyncState()
  return { synced, pending: await queueCount() }
}

export const api = {
  register: payload => apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: payload => apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => apiRequest('/api/auth/me'),
  updateProfile: payload => apiRequest('/api/auth/me', { method: 'PATCH', body: JSON.stringify(payload) }),
  dashboard: () => apiRequest('/api/dashboard'),
  activities: () => apiRequest('/api/activities'),
  createActivity: payload => apiRequest('/api/activities', { method: 'POST', body: JSON.stringify(payload) }),
  deleteActivity: id => apiRequest(`/api/activities/${id}`, { method: 'DELETE' }),
  updateActivity: (id, payload) => apiRequest(`/api/activities/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  attendance: () => apiRequest('/api/attendance'),
  createAttendance: payload => apiRequest('/api/attendance', { method: 'POST', body: JSON.stringify(payload) }),
  deleteAttendance: id => apiRequest(`/api/attendance/${id}`, { method: 'DELETE' }),
  expenses: () => apiRequest('/api/expenses'),
  createExpense: payload => apiRequest('/api/expenses', { method: 'POST', body: JSON.stringify(payload) }),
  finances: () => apiRequest('/api/finances'),
  createFinance: payload => apiRequest('/api/finances', { method: 'POST', body: JSON.stringify(payload) }),
  deleteFinance: id => apiRequest(`/api/finances/${id}`, { method: 'DELETE' }),
  weeklyReports: params => apiRequest('/api/weekly-reports' + (params ? '?' + new URLSearchParams(params).toString() : '')),
  saveWeeklyReport: payload => apiRequest('/api/weekly-reports', { method: 'POST', body: JSON.stringify(payload) }),
  getWeeklyReport: id => apiRequest(`/api/weekly-reports/${id}`),
  updateWeeklyReport: (id, payload) => apiRequest(`/api/weekly-reports/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteWeeklyReport: id => apiRequest(`/api/weekly-reports/${id}`, { method: 'DELETE' }),
  staff: () => apiRequest('/api/admin/staff'),
  staffReviews: staffId => apiRequest(`/api/admin/staff/${staffId}/reviews`),
  createStaffReview: (staffId, payload) => apiRequest(`/api/admin/staff/${staffId}/reviews`, { method: 'POST', body: JSON.stringify(payload) }),
  staffInvitations: () => apiRequest('/api/admin/staff/invitations'),
  staffInvitationPreview: code => apiRequest('/api/auth/staff-invitation?code=' + encodeURIComponent(code)),
  createStaffInvitation: payload => apiRequest('/api/admin/staff/invitations', { method: 'POST', body: JSON.stringify(payload) }),
  staffCount: () => apiRequest('/api/admin/staff/count'),
  updateStaffStatus: (staffId, isActive) => apiRequest(`/api/admin/staff/${staffId}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  deleteStaff: staffId => apiRequest(`/api/admin/staff/${staffId}`, { method: 'DELETE' }),
  reportingCurrent: () => apiRequest('/api/reporting/current'),
  reportingMonths: year => apiRequest('/api/reporting/months?year=' + encodeURIComponent(year)),
  reportingMonth: id => apiRequest('/api/reporting/months/' + id),
  createReportingWeek: payload => apiRequest('/api/reporting/weeks', { method: 'POST', body: JSON.stringify(payload) }),
  updateReportingWeek: (id, payload) => apiRequest('/api/reporting/weeks/' + id, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteReportingWeek: id => apiRequest('/api/reporting/weeks/' + id, { method: 'DELETE' }),
  options: kind => apiRequest('/api/options' + (kind ? '?kind=' + encodeURIComponent(kind) : '')),
  createOption: payload => apiRequest('/api/options', { method: 'POST', body: JSON.stringify(payload) }),
  deleteOption: id => apiRequest(`/api/options/${id}`, { method: 'DELETE' }),
}
