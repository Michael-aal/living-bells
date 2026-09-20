const BASE = import.meta.env.VITE_API_BASE_URL || ''
export async function apiRequest(path, options = {}) {
  const response = await fetch(BASE + path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } })
  if (!response.ok) throw new Error('API request failed: ' + response.status)
  return response.json()
}
export const api = {
  dashboard: () => apiRequest('/api/dashboard'),
  attendance: () => apiRequest('/api/attendance'),
  createAttendance: payload => apiRequest('/api/attendance', { method:'POST', body:JSON.stringify(payload) }),
  expenses: () => apiRequest('/api/expenses'),
  createExpense: payload => apiRequest('/api/expenses', { method:'POST', body:JSON.stringify(payload) }),
}
