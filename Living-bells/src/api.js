const BASE = import.meta.env.VITE_API_BASE_URL || ''

function authHeaders() {
  const token = localStorage.getItem('living_bells_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiRequest(path, options = {}) {
  let response

  try {
    response = await fetch(BASE + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(options.headers || {}) },
    })
  } catch {
    throw new Error('Cannot reach the Living Bells API. Start the backend on port 5000 or use a demo account.')
  }

  const contentType = response.headers.get('content-type') || ''
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : {}

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('living_bells_token')
      localStorage.removeItem('living_bells_user')
      throw new Error(data.message || 'Your session has expired. Please sign in again.')
    }
    if (response.status === 403) {
      throw new Error(data.message || 'You do not have permission to perform this action.')
    }
    throw new Error(data.message || 'API request failed (' + response.status + ')')
  }

  return data
}

export const api = {
  register: payload => apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: payload => apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => apiRequest('/api/auth/me'),
  dashboard: () => apiRequest('/api/dashboard'),
  activities: () => apiRequest('/api/activities'),
  createActivity: payload => apiRequest('/api/activities', { method: 'POST', body: JSON.stringify(payload) }),
  attendance: () => apiRequest('/api/attendance'),
  createAttendance: payload => apiRequest('/api/attendance', { method: 'POST', body: JSON.stringify(payload) }),
  expenses: () => apiRequest('/api/expenses'),
  createExpense: payload => apiRequest('/api/expenses', { method: 'POST', body: JSON.stringify(payload) }),
  finances: () => apiRequest('/api/finances'),
  createFinance: payload => apiRequest('/api/finances', { method: 'POST', body: JSON.stringify(payload) }),
  staff: () => apiRequest('/api/admin/staff'),
  staffReviews: staffId => apiRequest(`/api/admin/staff/${staffId}/reviews`),
  createStaffReview: (staffId, payload) => apiRequest(`/api/admin/staff/${staffId}/reviews`, { method: 'POST', body: JSON.stringify(payload) }),
}
