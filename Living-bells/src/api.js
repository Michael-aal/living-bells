const BASE = import.meta.env.VITE_API_BASE_URL || ''

function authHeaders() {
  const token = localStorage.getItem('living_bells_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}
export async function apiRequest(path, options = {}) {
  const response = await fetch(BASE + path, { ...options, headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(options.headers || {}) } })
  if (!response.ok) throw new Error('API request failed: ' + response.status)
  return response.json()
}
export const api = {
  register: payload => apiRequest('/api/auth/register', { method:'POST', body:JSON.stringify(payload) }),
  login: payload => apiRequest('/api/auth/login', { method:'POST', body:JSON.stringify(payload) }),
  me: () => apiRequest('/api/auth/me'),
  dashboard: () => apiRequest('/api/dashboard'),
  attendance: () => apiRequest('/api/attendance'),
  createAttendance: payload => apiRequest('/api/attendance', { method:'POST', body:JSON.stringify(payload) }),
  expenses: () => apiRequest('/api/expenses'),
  createExpense: payload => apiRequest('/api/expenses', { method:'POST', body:JSON.stringify(payload) }),
}
