const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

function getTokens() {
  return {
    access: localStorage.getItem('access_token'),
    refresh: localStorage.getItem('refresh_token'),
  }
}

export function setTokens(access, refresh) {
  localStorage.setItem('access_token', access)
  if (refresh) localStorage.setItem('refresh_token', refresh)
}

export function clearTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

async function refreshAccessToken() {
  const { refresh } = getTokens()
  if (!refresh) throw new Error('No refresh token')
  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  })
  if (!res.ok) {
    clearTokens()
    throw new Error('Session expired')
  }
  const data = await res.json()
  setTokens(data.access_token, data.refresh_token)
  return data.access_token
}

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const { access } = getTokens()
  if (access) headers.Authorization = `Bearer ${access}`

  let res
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers })
  } catch {
    throw new Error('Failed to fetch')
  }

  if (res.status === 401 && getTokens().refresh) {
    try {
      const newAccess = await refreshAccessToken()
      headers.Authorization = `Bearer ${newAccess}`
      res = await fetch(`${API_URL}${path}`, { ...options, headers })
    } catch {
      clearTokens()
      throw new Error('Please log in again')
    }
  }

  if (res.status === 204) return null

  let body = null
  const text = await res.text()
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }

  if (!res.ok) {
    const detail = body?.detail
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg).join(', ')
      : detail || body?.message || res.statusText
    throw new Error(message)
  }
  return body
}

export const authApi = {
  register: (payload) => api('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload) => api('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  me: () => api('/auth/me'),
}

export const marketApi = {
  symbols: () => api('/market/symbols'),
  quotes: () => api('/market/quotes'),
  history: (symbol, period = '1mo') =>
    api(`/market/history/${encodeURIComponent(symbol)}?period=${period}`),
}

export const portfolioApi = {
  get: () => api('/portfolio'),
  update: (symbols) => api('/portfolio', { method: 'PUT', body: JSON.stringify({ symbols }) }),
}

export const alertsApi = {
  list: () => api('/alerts'),
  create: (payload) => api('/alerts', { method: 'POST', body: JSON.stringify(payload) }),
  remove: (id) => api(`/alerts/${id}`, { method: 'DELETE' }),
}
