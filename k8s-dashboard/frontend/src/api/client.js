import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

// Injection automatique du token JWT
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Refresh automatique si 401
apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, null, {
          headers: { Authorization: `Bearer ${refresh}` },
        })
        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        original.headers.Authorization = `Bearer ${data.access_token}`
        return apiClient(original)
      } catch {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

// ─── Fonctions API ────────────────────────────────────────────

export const api = {
  // Auth
  login: (credentials) => apiClient.post('/auth/login', credentials).then(r => r.data),

  // Risk Score
  getRiskScore: (namespace) =>
    apiClient.get('/risk-score', { params: namespace ? { namespace } : {} }).then(r => r.data),
  getRiskHistory: (days = 7, namespace) =>
    apiClient.get('/risk-score/history', { params: { days, ...(namespace ? { namespace } : {}) } }).then(r => r.data),

  // Incidents
  getIncidents: (params) => apiClient.get('/incidents', { params }).then(r => r.data),
  getIncident: (id) => apiClient.get(`/incidents/${id}`).then(r => r.data),
  getIncidentTimeline: (id) => apiClient.get(`/incidents/${id}/timeline`).then(r => r.data),
  getIncidentTimer: (id) => apiClient.get(`/incidents/${id}/timer`).then(r => r.data),
  cancelIncident: (id) => apiClient.post(`/incidents/${id}/cancel`).then(r => r.data),
  resolveIncident: (id) => apiClient.post(`/incidents/${id}/resolve`).then(r => r.data),

  // Namespace / Pods
  getNamespaces: () => apiClient.get('/incidents/namespaces/list').then(r => r.data),
  getPods: (namespace) =>
    apiClient.get('/incidents/pods/list', { params: namespace ? { namespace } : {} }).then(r => r.data),

  // Dashboard
  getDashboardSummary: (namespace) =>
    apiClient.get('/dashboard/summary', { params: namespace ? { namespace } : {} }).then(r => r.data),
}
